import { supabaseAdmin } from './supabase';

/**
 * Een slot op te veel pogingen, zoals wachtwoorden of codes raden. Per sleutel
 * ("login:naam@voorbeeld.nl") telt de database de mislukte pogingen binnen een
 * venster; zijn het er te veel, dan staat de sleutel een tijdje op slot.
 *
 * Bewust in de database en niet in het geheugen: op Vercel draait elke
 * aanvraag mogelijk op een andere server, die van elkaars tellers niets weten.
 */

export interface Limit {
  /** Zoveel pogingen mogen binnen het venster */
  max: number;
  /** Het venster en de duur van het slot, in minuten */
  minutes: number;
}

/** Inloggen: 5 keer mis binnen 15 minuten, dan 15 minuten wachten */
export const LOGIN_LIMIT: Limit = { max: 5, minutes: 15 };

/** Herstellinks aanvragen: 3 per uur per e-mailadres */
export const RESET_LIMIT: Limit = { max: 3, minutes: 60 };

/** Of deze sleutel nu op slot staat */
export async function isLocked(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('login_attempts').select('locked_until').eq('key', key).maybeSingle();
  return !!data?.locked_until && new Date(data.locked_until) > new Date();
}

/**
 * Telt een poging. Geeft true terug als de sleutel daarmee op slot gaat (of al
 * stond). Een venster dat verlopen is, begint opnieuw bij 1.
 */
export async function registerAttempt(key: string, limit: Limit): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - limit.minutes * 60_000);

  const { data } = await supabaseAdmin
    .from('login_attempts')
    .select('attempts, first_attempt_at, locked_until')
    .eq('key', key)
    .maybeSingle();

  if (data?.locked_until && new Date(data.locked_until) > now) return true;

  const fresh = !data || new Date(data.first_attempt_at) < windowStart;
  const attempts = fresh ? 1 : data.attempts + 1;
  const locked = attempts >= limit.max;

  await supabaseAdmin.from('login_attempts').upsert({
    key,
    attempts,
    first_attempt_at: fresh ? now.toISOString() : data.first_attempt_at,
    locked_until: locked ? new Date(now.getTime() + limit.minutes * 60_000).toISOString() : null,
  });

  return locked;
}

/** Na een geslaagde poging begint de teller weer bij nul */
export async function clearAttempts(key: string): Promise<void> {
  await supabaseAdmin.from('login_attempts').delete().eq('key', key);
}
