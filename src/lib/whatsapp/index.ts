import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import type { WhatsAppAccountInfo, WhatsAppConfig } from './types';

export * from './types';

/**
 * WhatsApp via de Cloud API van Meta.
 *
 * Resynked heeft één eigen WhatsApp-nummer, de bot. Een gebruiker koppelt zijn
 * eigen mobiele nummer daaraan door vanaf zijn telefoon een code te sturen;
 * daarmee is bewezen dat het nummer van hem is. Daarna herkennen we elk
 * bericht aan het nummer van de afzender.
 *
 * Op een bericht van iemand mag de bot 24 uur lang vrij antwoorden; daarom
 * begint het gesprek altijd bij de gebruiker en zijn er geen goedgekeurde
 * sjablonen nodig.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';

/** Hoe lang een koppelcode geldig is. */
const LINK_CODE_MINUTES = 15;

/** Zonder deze vijf staat WhatsApp uit; de plug-in toont dan dat hij nog niet beschikbaar is. */
export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_APP_SECRET &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_NUMBER
  );
}

/** Het nummer van de bot, alleen cijfers met landcode, zoals 31612345678. */
export function botNumber(): string {
  return (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
}

/** Een nummer zoals mensen het lezen: +31 6 12345678 voor Nederlandse mobiele nummers. */
export function formatPhone(digits: string): string {
  const match = digits.match(/^31(6)(\d{8})$/);
  return match ? `+31 ${match[1]} ${match[2]}` : `+${digits}`;
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

async function graph(body: Record<string, unknown>) {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`WhatsApp gaf een fout (${response.status}): ${detail}`);
  }
}

/** Een tekstbericht terug. WhatsApp kent *vet* en _schuin_, verder platte tekst. */
export async function sendText(to: string, body: string) {
  await graph({
    recipient_type: 'individual',
    to,
    type: 'text',
    // Een bericht mag hooguit 4096 tekens zijn
    text: { body: body.slice(0, 4096), preview_url: false },
  });
}

/**
 * Twee blauwe vinkjes en "aan het typen…", zodat de aannemer ziet dat er aan
 * zijn offerte gewerkt wordt. Lukt het niet, dan is dat geen ramp.
 */
export async function markReadAndTyping(messageId: string) {
  try {
    await graph({ status: 'read', message_id: messageId, typing_indicator: { type: 'text' } });
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
  phone: string | null;
  link_code: string | null;
  link_code_expires_at: string | null;
  pending_text: string | null;
  pending_at: string | null;
}

export function linkMessage(code: string) {
  return `Koppel ${code}`;
}

export function whatsAppConfig(): WhatsAppConfig {
  const configured = isWhatsAppConfigured();
  return { configured, botNumber: configured ? formatPhone(botNumber()) : null };
}

function toAccountInfo(account: WhatsAppAccountRow): WhatsAppAccountInfo {
  const open =
    account.link_code && account.link_code_expires_at && new Date(account.link_code_expires_at) > new Date()
      ? account.link_code
      : null;

  return {
    phone: account.phone ? formatPhone(account.phone) : null,
    linking: open
      ? {
          code: open,
          message: linkMessage(open),
          link: `https://wa.me/${botNumber()}?text=${encodeURIComponent(linkMessage(open))}`,
          expiresAt: account.link_code_expires_at!,
        }
      : null,
  };
}

export async function getWhatsAppAccount(userId: string): Promise<WhatsAppAccountInfo | null> {
  const { data, error } = await supabaseAdmin.from('whatsapp_accounts').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? toAccountInfo(data as WhatsAppAccountRow) : null;
}

/** Zes tekens zonder letters die op elkaar lijken, zoals O en 0. */
function newCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/** Begint een koppeling: een verse code, een kwartier geldig. Een eerder gekoppeld nummer blijft tot de code binnen is. */
export async function startLinking(userId: string, tenantId: string): Promise<WhatsAppAccountInfo> {
  const expires = new Date(Date.now() + LINK_CODE_MINUTES * 60_000).toISOString();

  // Een code die toevallig al in gebruik is, geeft een conflict; dan een andere
  for (let poging = 0; poging < 5; poging++) {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_accounts')
      .upsert(
        { user_id: userId, tenant_id: tenantId, link_code: newCode(), link_code_expires_at: expires },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (!error) return toAccountInfo(data as WhatsAppAccountRow);
    if (error.code !== '23505') throw error;
  }

  throw new Error('Kon geen koppelcode maken. Probeer het opnieuw.');
}

/**
 * Een binnengekomen code: het nummer dat hem stuurt hoort voortaan bij die
 * gebruiker. Had iemand anders dit nummer, dan vervalt die koppeling; een
 * telefoon hoort bij één gebruiker.
 */
export async function completeLinking(code: string, phone: string): Promise<WhatsAppAccountRow | null> {
  const { data: account, error } = await supabaseAdmin
    .from('whatsapp_accounts')
    .select('*')
    .eq('link_code', code.toUpperCase())
    .gt('link_code_expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!account) return null;

  const { error: releaseError } = await supabaseAdmin
    .from('whatsapp_accounts')
    .update({ phone: null })
    .eq('phone', phone)
    .neq('id', account.id);
  if (releaseError) throw releaseError;

  const { data, error: linkError } = await supabaseAdmin
    .from('whatsapp_accounts')
    .update({ phone, link_code: null, link_code_expires_at: null, pending_text: null, pending_at: null })
    .eq('id', account.id)
    .select('*')
    .single();
  if (linkError) throw linkError;

  return data;
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

export async function deleteWhatsAppAccount(userId: string) {
  const { error } = await supabaseAdmin.from('whatsapp_accounts').delete().eq('user_id', userId);
  if (error) throw error;
}
