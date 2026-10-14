import { supabaseAdmin } from '@/lib/supabase';
import { decrypt, encrypt } from '@/lib/crypto';
import { appUrl } from '@/lib/email';
import { google } from './google';
import { microsoft } from './microsoft';
import { MAIL_PROVIDERS, MailAuthError, type CalendarEventInput, type MailProvider, type MailProviderName, type MailTokens } from './types';

export * from './types';

const PROVIDERS: Record<MailProviderName, MailProvider> = { google, microsoft };

/** Hiermee controleert de terugkeer na het inloggen dat het koppelen bij ons begon. */
export const STATE_COOKIE = 'mail_oauth_state';

export function isMailProvider(value: unknown): value is MailProviderName {
  return MAIL_PROVIDERS.includes(value as MailProviderName);
}

export function mailProvider(name: MailProviderName): MailProvider {
  return PROVIDERS[name];
}

/** Waar de aanbieder na het inloggen naar terugstuurt; moet zo bij hen geregistreerd staan. */
export function redirectUri(name: MailProviderName): string {
  return `${appUrl()}/api/mail/callback/${name}`;
}

interface MailAccountRow {
  id: number;
  tenant_id: string;
  user_id: string;
  provider: MailProviderName;
  email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
}

/** Wat de rest van de app van een koppeling mag weten: geen sleutels. */
export interface MailAccountInfo {
  provider: MailProviderName;
  email: string;
}

async function findAccount(userId: string): Promise<MailAccountRow | null> {
  const { data, error } = await supabaseAdmin
    .from('mail_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as MailAccountRow | null;
}

export async function getMailAccount(userId: string): Promise<MailAccountInfo | null> {
  const account = await findAccount(userId);
  return account ? { provider: account.provider, email: account.email } : null;
}

/** Bewaart een nieuwe koppeling; een eerdere koppeling van deze gebruiker wordt vervangen. */
export async function saveMailAccount(
  userId: string,
  tenantId: string,
  provider: MailProviderName,
  email: string,
  tokens: MailTokens
) {
  if (!tokens.refreshToken) {
    throw new Error('De mailaanbieder gaf geen blijvende toegang. Probeer het opnieuw.');
  }

  const { error } = await supabaseAdmin.from('mail_accounts').upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      provider,
      email,
      refresh_token: encrypt(tokens.refreshToken),
      access_token: encrypt(tokens.accessToken),
      access_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}

/** Ontkoppelt de mailbox: de toegang wordt ingetrokken en de sleutels gaan weg. */
export async function deleteMailAccount(userId: string) {
  const account = await findAccount(userId);
  if (!account) return;

  await mailProvider(account.provider).revoke(decrypt(account.refresh_token)).catch(() => {});

  const { error } = await supabaseAdmin.from('mail_accounts').delete().eq('user_id', userId);
  if (error) throw error;
}

/**
 * De gekoppelde mailbox van deze gebruiker, met een geldige toegangssleutel.
 * Een sleutel leeft een uur; is hij (bijna) verlopen, dan halen we een nieuwe.
 */
export async function openMailbox(userId: string) {
  const account = await findAccount(userId);
  if (!account) throw new MailAuthError('Er is geen mailbox gekoppeld');

  const provider = mailProvider(account.provider);
  const expiresAt = account.access_token_expires_at ? Date.parse(account.access_token_expires_at) : 0;

  let accessToken: string;
  if (account.access_token && expiresAt > Date.now() + 60_000) {
    accessToken = decrypt(account.access_token);
  } else {
    const tokens = await provider.refresh(decrypt(account.refresh_token));
    accessToken = tokens.accessToken;

    // Microsoft geeft bij elke verversing een nieuwe blijvende sleutel mee
    await supabaseAdmin
      .from('mail_accounts')
      .update({
        access_token: encrypt(tokens.accessToken),
        access_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        ...(tokens.refreshToken ? { refresh_token: encrypt(tokens.refreshToken) } : {}),
      })
      .eq('id', account.id);
  }

  return { provider, accessToken, email: account.email };
}

/**
 * Een fout uit de mailbox als antwoord van de API. Is de koppeling verlopen,
 * dan krijgt het scherm dat apart te horen, zodat het om opnieuw koppelen vraagt.
 */
export function sendMailError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof MailAuthError) {
    return res.status(409).json({ error: error.message, reconnect: true });
  }

  console.error('Mailbox:', error);
  return res.status(502).json({ error: (error as Error)?.message || 'De mailbox is niet bereikbaar' });
}

/** Het bericht met de handtekening eronder, met wat witruimte ertussen. */
export function withSignature(html: string, signature: string): string {
  return signature ? `${html}<br><div class="signature">${signature}</div>` : html;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Controleert een afspraak zoals hij van het scherm komt. Geeft de afspraak
 * terug, of een leesbare fout.
 */
export function parseEventInput(body: any): { event: CalendarEventInput } | { error: string } {
  const title = String(body?.title || '').trim();
  if (!title) return { error: 'Geef de afspraak een titel' };

  const allDay = !!body?.allDay;
  const start = String(body?.start || '');
  const end = String(body?.end || '');

  if (allDay ? !DATE.test(start) || !DATE.test(end) : Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
    return { error: 'Vul een geldige begin- en eindtijd in' };
  }
  if (allDay ? end <= start : Date.parse(end) <= Date.parse(start)) {
    return { error: 'Het einde moet na het begin liggen' };
  }

  const text = (value: unknown) => (value === undefined ? undefined : String(value));

  return {
    event: { title, allDay, start, end, location: text(body?.location), description: text(body?.description) },
  };
}
