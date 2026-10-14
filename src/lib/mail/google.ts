import { INBOX_FOLDER, type CalendarEvent, type CalendarEventInput, type MailFolder, type MailFolderKind, type MailMessage, type MailProvider, type MailSummary } from './types';
import {
  apiFetch,
  decodeEntities,
  forwardHeader,
  forwardSubject,
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

// Mail lezen, als gelezen markeren en versturen, en afspraken in de agenda
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
];

/** Een afspraak zoals Google Agenda hem wil ontvangen. */
function toGoogleEvent(event: CalendarEventInput) {
  const moment = (value: string) => (event.allDay ? { date: value.slice(0, 10) } : { dateTime: value });
  return {
    summary: event.title,
    start: moment(event.start),
    end: moment(event.end),
    ...(event.location !== undefined ? { location: event.location } : {}),
    ...(event.description !== undefined ? { description: event.description } : {}),
  };
}

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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
    starred: !!message.labelIds?.includes('STARRED'),
  };
}

/** De vaste labels van Gmail die als map in de inbox horen, in deze volgorde. */
const SYSTEM_LABELS: { id: string; name: string; kind: MailFolderKind }[] = [
  { id: 'INBOX', name: 'Inbox', kind: 'inbox' },
  { id: 'STARRED', name: 'Met ster', kind: 'starred' },
  { id: 'IMPORTANT', name: 'Belangrijk', kind: 'important' },
  { id: 'SENT', name: 'Verzonden', kind: 'sent' },
  { id: 'DRAFT', name: 'Concepten', kind: 'drafts' },
  { id: 'SPAM', name: 'Spam', kind: 'spam' },
  { id: 'TRASH', name: 'Prullenbak', kind: 'trash' },
];

/** De inbox heet bij ons overal "inbox"; Gmail noemt hem INBOX. */
function labelId(folder: string): string {
  return folder === INBOX_FOLDER ? 'INBOX' : folder;
}

/** Een onderwerp met andere tekens dan ASCII moet gecodeerd in de kop. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function formatAddresses(value: string): string {
  return parseAddressList(value)
    .map(address => (address.name !== address.email ? `${encodeHeader(address.name)} <${address.email}>` : address.email))
    .join(', ');
}

/** Verstuurt een zelfgebouwd bericht, in het gesprek waar het bij hoort. */
async function sendMime(accessToken: string, threadId: string | undefined, headers: string[], html: string) {
  const mime = [
    ...headers,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');

  await apiFetch(`${API}/messages/send`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw: Buffer.from(mime, 'utf8').toString('base64url'), threadId }),
  });
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

  async list(accessToken, { folder, unreadOnly, search, pageToken }) {
    const params = new URLSearchParams({ maxResults: '25' });
    // Zoeken gaat door alle mail heen, zoals in Gmail zelf
    if (!search) params.set('labelIds', labelId(folder));
    const query = [search?.trim(), unreadOnly ? 'is:unread' : ''].filter(Boolean).join(' ');
    if (query) params.set('q', query);
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

  async folders(accessToken) {
    const { labels = [] } = await apiFetch(`${API}/labels`, accessToken);
    const ids = new Set(labels.map((label: any) => label.id));

    const system: MailFolder[] = SYSTEM_LABELS.filter(label => ids.has(label.id)).map(label => ({
      id: label.id === 'INBOX' ? INBOX_FOLDER : label.id,
      name: label.name,
      kind: label.kind,
    }));

    // De labels die de gebruiker zelf heeft gemaakt, op naam
    const own: MailFolder[] = labels
      .filter((label: any) => label.type === 'user')
      .map((label: any) => ({ id: label.id, name: label.name, kind: 'custom' as const }))
      .sort((a: MailFolder, b: MailFolder) => a.name.localeCompare(b.name, 'nl'));

    const inbox = system.find(folder => folder.kind === 'inbox');
    if (inbox) inbox.unread = await this.unreadCount(accessToken);

    return [...system, ...own];
  },

  async unreadCount(accessToken) {
    const inbox = await apiFetch(`${API}/labels/INBOX`, accessToken);
    return Number(inbox.threadsUnread) || 0;
  },

  async signature(accessToken, ownAddress) {
    const { sendAs = [] } = await apiFetch(`${API}/settings/sendAs`, accessToken);
    const own =
      sendAs.find((alias: any) => alias.sendAsEmail?.toLowerCase() === ownAddress.toLowerCase()) ||
      sendAs.find((alias: any) => alias.isDefault) ||
      sendAs.find((alias: any) => alias.isPrimary);
    return own?.signature || '';
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
    const to = formatAddresses(fromSelf ? header(last, 'To') : header(last, 'Reply-To') || header(last, 'From'));

    const messageId = header(last, 'Message-ID');
    const references = [header(last, 'References'), messageId].filter(Boolean).join(' ');

    await sendMime(
      accessToken,
      id,
      [
        `From: ${ownAddress}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(replySubject(header(messages[0], 'Subject')))}`,
        ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${references}`] : []),
      ],
      html
    );
  },

  async archive(accessToken, id) {
    // Archiveren is in Gmail niets anders dan het label Inbox eraf halen
    await apiFetch(`${API}/threads/${encodeURIComponent(id)}/modify`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
    });
  },

  async trash(accessToken, id) {
    await apiFetch(`${API}/threads/${encodeURIComponent(id)}/trash`, accessToken, { method: 'POST' });
  },

  async setStarred(accessToken, messageId, starred) {
    await apiFetch(`${API}/messages/${encodeURIComponent(messageId)}/modify`, accessToken, {
      method: 'POST',
      body: JSON.stringify(starred ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] }),
    });
  },

  async compose(accessToken, to, subject, html, ownAddress) {
    await sendMime(
      accessToken,
      undefined,
      [`From: ${ownAddress}`, `To: ${formatAddresses(to.join(', '))}`, `Subject: ${encodeHeader(subject)}`],
      html
    );
  },

  async forward(accessToken, threadId, messageId, to, html, ownAddress) {
    const message: GmailMessage = await apiFetch(`${API}/messages/${encodeURIComponent(messageId)}?format=full`, accessToken);
    const original = toMessage(message);
    const subject = header(message, 'Subject');
    const originalId = header(message, 'Message-ID');

    await sendMime(
      accessToken,
      threadId,
      [
        `From: ${ownAddress}`,
        `To: ${formatAddresses(to.join(', '))}`,
        `Subject: ${encodeHeader(forwardSubject(subject))}`,
        ...(originalId ? [`References: ${originalId}`] : []),
      ],
      html +
        forwardHeader({
          from: header(message, 'From'),
          date: original.date,
          subject,
          to: header(message, 'To'),
        }) +
        original.html
    );
  },

  async events(accessToken, from, to) {
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;

    // Herhalende afspraken los, zoals ze in de agenda staan; hooguit een paar pagina's
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await apiFetch(`${CALENDAR_API}?${params}`, accessToken);
      (data.items || [])
        .filter((item: any) => item.status !== 'cancelled')
        .forEach((item: any) => {
          const allDay = !item.start?.dateTime;
          events.push({
            id: item.id,
            title: item.summary || '(geen titel)',
            start: item.start?.dateTime || item.start?.date,
            end: item.end?.dateTime || item.end?.date,
            allDay,
            location: item.location || '',
            description: item.description || '',
            url: item.htmlLink || null,
          });
        });

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    return events;
  },

  async createEvent(accessToken, event) {
    await apiFetch(CALENDAR_API, accessToken, { method: 'POST', body: JSON.stringify(toGoogleEvent(event)) });
  },

  async updateEvent(accessToken, id, event) {
    // PATCH: wat we niet meesturen, zoals gasten of een Meet-link, blijft staan
    await apiFetch(`${CALENDAR_API}/${encodeURIComponent(id)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(toGoogleEvent(event)),
    });
  },

  async deleteEvent(accessToken, id) {
    await apiFetch(`${CALENDAR_API}/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
  },

  async revoke(token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  },
};
