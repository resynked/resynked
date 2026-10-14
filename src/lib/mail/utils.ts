import { MailAuthError, type MailAddress, type MailTokens } from './types';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPES[char]);
}

/** Een bericht zonder HTML-versie, met zijn regelafbrekingen intact. */
export function textToHtml(text: string): string {
  return `<div style="white-space: pre-wrap">${escapeHtml(text)}</div>`;
}

/** De voorvertoning komt bij Gmail met HTML-entiteiten, zoals &#39;. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** "Jan Jansen <jan@voorbeeld.nl>" wordt { name, email }. */
export function parseAddress(value: string): MailAddress {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || match[2].trim(), email: match[2].trim() };

  const email = value.trim();
  return { name: email, email };
}

/** Een lijst als "a@b.nl, Jan <jan@c.nl>"; komma's binnen aanhalingstekens tellen niet. */
export function parseAddressList(value: string | undefined): MailAddress[] {
  if (!value) return [];
  return (value.match(/("[^"]*"|[^,])+/g) || []).map(parseAddress).filter(address => address.email);
}

/** Vraagt sleutels op bij de aanbieder, voor het eerst of opnieuw. */
export async function requestTokens(url: string, params: Record<string, string>): Promise<MailTokens> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // invalid_grant: de toegang is ingetrokken of verlopen
    if (data.error === 'invalid_grant') throw new MailAuthError('De koppeling met je mailbox is verlopen');
    throw new Error(data.error_description || data.error || 'Inloggen bij de mailaanbieder mislukt');
  }

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: Number(data.expires_in) || 3600 };
}

/** Een verzoek aan de API van de aanbieder, met een duidelijke fout als het misgaat. */
export async function apiFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) throw new MailAuthError('De koppeling met je mailbox is verlopen');

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message: string = data.error?.message || '';

    // Een koppeling van vóór de agenda heeft daar nog geen toestemming voor;
    // opnieuw koppelen lost dat op
    const missingScope =
      response.status === 403 &&
      (/insufficient/i.test(message) ||
        ['ErrorAccessDenied', 'AccessDenied', 'Authorization_RequestDenied'].includes(data.error?.code));
    if (missingScope) throw new MailAuthError('Geef Resynked opnieuw toegang om dit te kunnen zien');

    throw new Error(message || `De mailaanbieder antwoordde met ${response.status}`);
  }

  return response.status === 202 || response.status === 204 ? null : response.json().catch(() => null);
}

/** "Re: " ervoor, maar niet twee keer. */
export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

/** "Fwd: " ervoor, maar niet twee keer. */
export function forwardSubject(subject: string): string {
  return /^(fw|fwd):/i.test(subject.trim()) ? subject : `Fwd: ${subject}`;
}

/** Het kopje boven een doorgestuurd bericht, zoals Gmail en Outlook het ook zetten. */
export function forwardHeader(original: { from: string; date: string; subject: string; to: string }): string {
  const date = new Date(original.date).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });

  return `<br><br><div>---------- Doorgestuurd bericht ----------<br>
Van: ${escapeHtml(original.from)}<br>
Datum: ${escapeHtml(date)}<br>
Onderwerp: ${escapeHtml(original.subject)}<br>
Aan: ${escapeHtml(original.to)}</div><br>`;
}
