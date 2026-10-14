import type { MailMessage, MailProvider, MailSummary } from './types';
import {
  apiFetch,
  decodeEntities,
  parseAddress,
  parseAddressList,
  replySubject,
  requestTokens,
  textToHtml,
} from './utils';

/**
 * Gmail, via de Gmail API.
 *
 * In Gmail is een gesprek een "thread"; de lijst in de inbox bestaat daarom
 * uit threads, en antwoorden gebeurt in dezelfde thread zodat het in Gmail
 * netjes onder het gesprek komt te staan.
 */

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Lezen, als gelezen markeren en versturen; meer niet
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify'];

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Zet GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in de omgevingsvariabelen');
  return { clientId, clientSecret };
}

interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
}

function header(message: GmailMessage, name: string): string {
  const found = message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return found?.value || '';
}

function decode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

/** Zoekt in de onderdelen van een bericht de inhoud; HTML gaat voor platte tekst. */
function findBody(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return decode(part.body.data);

  for (const child of part.parts || []) {
    const found = findBody(child, mimeType);
    if (found !== null) return found;
  }

  return null;
}

function toMessage(message: GmailMessage): MailMessage {
  const html = findBody(message.payload, 'text/html');
  const text = html === null ? findBody(message.payload, 'text/plain') : null;

  return {
    id: message.id,
    from: parseAddress(header(message, 'From')),
    to: parseAddressList(header(message, 'To')),
    cc: parseAddressList(header(message, 'Cc')),
    date: new Date(Number(message.internalDate) || Date.parse(header(message, 'Date'))).toISOString(),
    html: html ?? textToHtml(text || ''),
  };
}

/** Een onderwerp met andere tekens dan ASCII moet gecodeerd in de kop. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export const google: MailProvider = {
  authorizeUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: credentials().clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      // Zonder deze twee krijgen we geen sleutel waarmee we later opnieuw binnenkomen
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = credentials();
    return requestTokens(TOKEN_URL, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
  },

  refresh(refreshToken) {
    const { clientId, clientSecret } = credentials();
    return requestTokens(TOKEN_URL, {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });
  },

  async address(accessToken) {
    const profile = await apiFetch(`${API}/profile`, accessToken);
    return profile.emailAddress;
  },

  async list(accessToken, { unreadOnly, pageToken }) {
    const params = new URLSearchParams({ labelIds: 'INBOX', maxResults: '25' });
    if (unreadOnly) params.set('q', 'is:unread');
    if (pageToken) params.set('pageToken', pageToken);

    const page = await apiFetch(`${API}/threads?${params}`, accessToken);
    const threads: { id: string; snippet?: string }[] = page.threads || [];

    // Per gesprek alleen de koppen, niet de hele inhoud: dat scheelt veel
    const items = await Promise.all(
      threads.map(async ({ id, snippet }): Promise<MailSummary> => {
        const metadata = new URLSearchParams({ format: 'metadata' });
        ['From', 'Subject', 'Date'].forEach(name => metadata.append('metadataHeaders', name));

        const thread = await apiFetch(`${API}/threads/${id}?${metadata}`, accessToken);
        const messages: GmailMessage[] = thread.messages || [];
        const first = messages[0];
        const last = messages[messages.length - 1];

        return {
          id,
          subject: header(first, 'Subject') || '(geen onderwerp)',
          from: parseAddress(header(last, 'From')),
          snippet: decodeEntities(snippet || ''),
          date: new Date(Number(last?.internalDate) || Date.now()).toISOString(),
          unread: messages.some(message => message.labelIds?.includes('UNREAD')),
        };
      })
    );

    return { items, nextPageToken: page.nextPageToken || null };
  },

  async thread(accessToken, id) {
    const thread = await apiFetch(`${API}/threads/${encodeURIComponent(id)}?format=full`, accessToken);
    const messages: GmailMessage[] = thread.messages || [];

    return {
      id,
      subject: header(messages[0], 'Subject') || '(geen onderwerp)',
      messages: messages.map(toMessage),
    };
  },

  async markRead(accessToken, id) {
    await apiFetch(`${API}/threads/${encodeURIComponent(id)}/modify`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
  },

  async reply(accessToken, id, html, ownAddress) {
    const thread = await apiFetch(
      `${API}/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,
      accessToken
    );
    const messages: GmailMessage[] = thread.messages || [];
    const last = messages[messages.length - 1];
    if (!last) throw new Error('Dit gesprek bestaat niet meer');

    // Antwoorden naar wie het laatste bericht stuurde. Was dat jijzelf, dan
    // naar wie jij het stuurde
    const fromSelf = parseAddress(header(last, 'From')).email.toLowerCase() === ownAddress.toLowerCase();
    // Gmail geeft de namen al ontsleuteld terug; voor de kop gaan ze er weer gecodeerd in
    const to = parseAddressList(fromSelf ? header(last, 'To') : header(last, 'Reply-To') || header(last, 'From'))
      .map(address => (address.name !== address.email ? `${encodeHeader(address.name)} <${address.email}>` : address.email))
      .join(', ');

    const messageId = header(last, 'Message-ID');
    const references = [header(last, 'References'), messageId].filter(Boolean).join(' ');

    const mime = [
      `From: ${ownAddress}`,
      `To: ${to}`,
      `Subject: ${encodeHeader(replySubject(header(messages[0], 'Subject')))}`,
      ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${references}`] : []),
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
    ].join('\r\n');

    await apiFetch(`${API}/messages/send`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ raw: Buffer.from(mime, 'utf8').toString('base64url'), threadId: id }),
    });
  },

  async revoke(token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  },
};
