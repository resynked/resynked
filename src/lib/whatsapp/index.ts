import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import type { WhatsAppAccountInfo, WhatsAppConfig } from './types';

export * from './types';

/**
 * WhatsApp via de Cloud API van Meta.
 *
 * Synbased heeft één eigen WhatsApp-nummer, de bot, met één toegangstoken uit
 * de app van Synbased bij Meta; die staan in de omgevingsvariabelen en gelden
 * voor iedereen. Een gebruiker vult bij Plug-ins alleen zijn eigen mobiele
 * nummer in; aan dat nummer herkennen we van wie een bericht is.
 *
 * Op een bericht van iemand mag de bot 24 uur lang vrij antwoorden; omdat het
 * gesprek altijd bij de gebruiker begint, zijn er geen goedgekeurde sjablonen
 * nodig.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';

/** Zonder token, nummer-ID en app-geheim kan de bot geen berichten lezen of sturen. */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET);
}

/** Alleen cijfers met landcode; een 06-nummer wordt 316... */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('06')) return `31${digits.slice(1)}`;
  return digits;
}

/** Een nummer zoals mensen het lezen: +31 6 12345678 voor Nederlandse mobiele nummers. */
export function formatPhone(digits: string): string {
  const match = digits.match(/^31(6)(\d{8})$/);
  return match ? `+31 ${match[1]} ${match[2]}` : `+${digits}`;
}

/** Meta controleert bij het instellen van de webhook of hij van ons is, met dit token. */
export function isVerifyToken(token: unknown): boolean {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  return !!expected && token === expected;
}

/**
 * Of een webhook echt van Meta komt: die tekent de ruwe inhoud met het
 * app-geheim. Zonder deze controle kan iedereen die de link kent offertes
 * laten aanmaken op naam van een gebruiker.
 */
export function verifySignature(rawBody: Buffer, header: string | undefined): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;

  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice('sha256='.length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function graph(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify({ messaging_product: 'whatsapp', ...body }) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp gaf een fout (${response.status}): ${data?.error?.message || 'onbekend'}`);
  return data;
}

// Het nummer van de bot verandert niet; één keer opvragen bij Meta is genoeg
let botNumberCache: Promise<string | null> | null = null;

function botNumber(): Promise<string | null> {
  if (!botNumberCache) {
    botNumberCache = graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number`)
      .then(data => normalizePhone(String(data.display_phone_number || '')) || null)
      .catch(error => {
        console.warn('WhatsApp-nummer opvragen:', error);
        // Volgende keer opnieuw proberen
        botNumberCache = null;
        return null;
      });
  }
  return botNumberCache;
}

export async function whatsAppConfig(): Promise<WhatsAppConfig> {
  if (!isWhatsAppConfigured()) return { configured: false, botNumber: null, tokenHint: null };

  const token = process.env.WHATSAPP_TOKEN!;
  const number = await botNumber();
  return {
    configured: true,
    botNumber: number ? formatPhone(number) : null,
    tokenHint: `${token.slice(0, 4)}••••••••${token.slice(-4)}`,
  };
}

/** Een tekstbericht terug. WhatsApp kent *vet* en _schuin_, verder platte tekst. */
export async function sendText(to: string, body: string) {
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    recipient_type: 'individual',
    to,
    type: 'text',
    // Een bericht mag hooguit 4096 tekens zijn
    text: { body: body.slice(0, 4096), preview_url: false },
  });
  console.info('WhatsApp: antwoord verstuurd naar', to);
}

/**
 * Twee blauwe vinkjes en "aan het typen…", zodat de gebruiker ziet dat er aan
 * zijn offerte gewerkt wordt. Lukt het niet, dan is dat geen ramp.
 */
export async function markReadAndTyping(messageId: string) {
  try {
    await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch (error) {
    console.warn('WhatsApp leesbevestiging:', error);
  }
}

/**
 * Meta stuurt een bericht opnieuw als ons antwoord te lang op zich laat
 * wachten. Het eerste verzoek dat een bericht claimt verwerkt het; de rest
 * slaat het over, zodat er nooit twee offertes van één bericht komen.
 */
export async function claimMessage(messageId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('whatsapp_messages').insert({ id: messageId });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

// ------------------------------------------------------------
// De koppeling per gebruiker
// ------------------------------------------------------------

export interface WhatsAppAccountRow {
  id: number;
  tenant_id: string;
  user_id: string;
  phone: string;
  pending_text: string | null;
  pending_at: string | null;
}

/** Het nummer is al van een andere gebruiker. */
export class WhatsAppPhoneTakenError extends Error {}

export async function getWhatsAppAccount(userId: string): Promise<WhatsAppAccountInfo | null> {
  const { data, error } = await supabaseAdmin.from('whatsapp_accounts').select('phone').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { phone: formatPhone(data.phone) } : null;
}

/** Bewaart het mobiele nummer; een eerder nummer van deze gebruiker wordt vervangen. */
export async function saveWhatsAppAccount(userId: string, tenantId: string, phone: string): Promise<WhatsAppAccountInfo> {
  const digits = normalizePhone(phone);
  const { error } = await supabaseAdmin
    .from('whatsapp_accounts')
    .upsert(
      { user_id: userId, tenant_id: tenantId, phone: digits, pending_text: null, pending_at: null },
      { onConflict: 'user_id' }
    );

  // Berichten herkennen we aan het nummer, dus één nummer hoort bij één gebruiker
  if (error?.code === '23505') throw new WhatsAppPhoneTakenError('Dit nummer is al door iemand anders in Synbased gekoppeld.');
  if (error) throw error;

  return { phone: formatPhone(digits) };
}

export async function deleteWhatsAppAccount(userId: string) {
  const { error } = await supabaseAdmin.from('whatsapp_accounts').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function findAccountByPhone(phone: string): Promise<WhatsAppAccountRow | null> {
  const { data, error } = await supabaseAdmin.from('whatsapp_accounts').select('*').eq('phone', phone).maybeSingle();
  if (error) throw error;
  return data;
}

/** Een bericht waar nog iets aan ontbrak, om met het volgende bericht samen te nemen. Null wist het. */
export async function setPending(accountId: number, text: string | null) {
  const { error } = await supabaseAdmin
    .from('whatsapp_accounts')
    .update({ pending_text: text, pending_at: text ? new Date().toISOString() : null })
    .eq('id', accountId);
  if (error) throw error;
}
