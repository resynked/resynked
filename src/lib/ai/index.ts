import { supabaseAdmin } from '@/lib/supabase';
import { decrypt, encrypt } from '@/lib/crypto';
import type { MailThread } from '@/lib/mail/types';
import { anthropic } from './anthropic';
import { openai } from './openai';
import { AI_PROVIDERS, AiKeyError, type AiProvider, type AiProviderName, type PastQuoteLine } from './types';

export * from './types';

const PROVIDERS: Record<AiProviderName, AiProvider> = { anthropic, openai };

export function isAiProvider(value: unknown): value is AiProviderName {
  return AI_PROVIDERS.includes(value as AiProviderName);
}

export function aiProvider(name: AiProviderName): AiProvider {
  return PROVIDERS[name];
}

/** Wat de rest van de app van een AI-koppeling mag weten: geen sleutel. */
export interface AiAccountInfo {
  provider: AiProviderName;
}

export async function getAiAccount(userId: string): Promise<AiAccountInfo | null> {
  const { data, error } = await supabaseAdmin.from('ai_accounts').select('provider').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { provider: data.provider } : null;
}

/** Bewaart de sleutel; een eerdere AI-koppeling van deze gebruiker wordt vervangen. */
export async function saveAiAccount(userId: string, tenantId: string, provider: AiProviderName, apiKey: string) {
  const { error } = await supabaseAdmin
    .from('ai_accounts')
    .upsert({ user_id: userId, tenant_id: tenantId, provider, api_key: encrypt(apiKey) }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteAiAccount(userId: string) {
  const { error } = await supabaseAdmin.from('ai_accounts').delete().eq('user_id', userId);
  if (error) throw error;
}

/** De AI-dienst van deze gebruiker met zijn sleutel, om iets mee te vragen. */
export async function openAi(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('ai_accounts')
    .select('provider, api_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AiKeyError('Zet eerst Anthropic of OpenAI aan bij Plug-ins');

  return { name: data.provider as AiProviderName, provider: aiProvider(data.provider), apiKey: decrypt(data.api_key) };
}

/**
 * De prijzen uit eerdere offertes, per soort werk de nieuwste. Daarmee kan
 * de AI een prijs voorstellen die past bij wat dit bedrijf altijd rekent.
 */
export async function pastQuoteLines(tenantId: string, limit = 150): Promise<PastQuoteLine[]> {
  const { data, error } = await supabaseAdmin
    .from('quote_items')
    .select('description, unit, price, created_at, quote_elements(quote_blocks(quotes(quote_number)))')
    .eq('tenant_id', tenantId)
    .eq('is_heading', false)
    .gt('price', 0)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;

  const seen = new Set<string>();
  const lines: PastQuoteLine[] = [];

  for (const row of (data || []) as any[]) {
    const key = `${row.description.trim().toLowerCase()}|${(row.unit || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push({
      description: row.description.trim(),
      unit: row.unit || null,
      price: Number(row.price),
      quoteNumber: row.quote_elements?.quote_blocks?.quotes?.quote_number ?? null,
    });
    if (lines.length >= limit) break;
  }

  return lines;
}

/** Mail-HTML als leesbare tekst, met de alinea's en regels intact. */
function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Het hele gesprek als tekst, oudste bericht eerst, met wie wat schreef. */
export function threadToTranscript(thread: MailThread): string {
  return [
    `Onderwerp: ${thread.subject}`,
    ...thread.messages.map(message =>
      [
        '---',
        `Van: ${message.from.name} <${message.from.email}>`,
        `Datum: ${message.date}`,
        '',
        htmlToText(message.html),
      ].join('\n')
    ),
  ].join('\n');
}
