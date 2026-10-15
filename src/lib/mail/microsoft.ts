import { INBOX_FOLDER, MAIL_CATEGORIES, attachmentUrl, type MailAttachment, type CalendarEvent, type CalendarEventInput, type MailAddress, type MailFolder, type MailFolderKind, type MailProvider } from './types';
import { apiFetch, replaceCidImages, requestTokens, textToHtml } from './utils';

/**
 * Outlook, via Microsoft Graph. Werkt voor zakelijke Microsoft 365-accounts
 * en voor persoonlijke Outlook.com-adressen.
 *
 * Graph kent geen lijst van gesprekken, alleen van berichten. De inbox toont
 * daarom berichten; wie er een opent ziet het hele gesprek eromheen, ook wat
 * er vanuit Verzonden op geantwoord is.
 */

const API = 'https://graph.microsoft.com/v1.0/me';
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';

const SCOPES = ['openid', 'email', 'offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite'];

/**
 * Een afspraak zoals Outlook hem wil ontvangen, in UTC. Een hele dag moet van
 * middernacht tot middernacht lopen.
 */
function toGraphEvent(event: CalendarEventInput) {
  const moment = (value: string) => ({
    dateTime: event.allDay ? `${value.slice(0, 10)}T00:00:00` : new Date(value).toISOString().replace(/\.\d+Z$/, ''),
    timeZone: 'UTC',
  });

  return {
    subject: event.title,
    isAllDay: event.allDay,
    start: moment(event.start),
    end: moment(event.end),
    ...(event.location !== undefined ? { location: { displayName: event.location } } : {}),
    ...(event.description !== undefined ? { body: { contentType: 'text', content: event.description } } : {}),
  };
}

function credentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Zet MICROSOFT_CLIENT_ID en MICROSOFT_CLIENT_SECRET in de omgevingsvariabelen');
  }
  return { clientId, clientSecret };
}

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

function toAddress(recipient: GraphRecipient | undefined): MailAddress {
  const email = recipient?.emailAddress?.address || '';
  return { name: recipient?.emailAddress?.name || email, email };
}

/** De vaste mappen van Outlook, op hun vaste naam, in deze volgorde. */
const WELL_KNOWN: { name: string; label: string; kind: MailFolderKind }[] = [
  { name: 'inbox', label: 'Inbox', kind: 'inbox' },
  { name: 'sentitems', label: 'Verzonden', kind: 'sent' },
  { name: 'drafts', label: 'Concepten', kind: 'drafts' },
  { name: 'archive', label: 'Archief', kind: 'archive' },
  { name: 'junkemail', label: 'Ongewenste e-mail', kind: 'spam' },
  { name: 'deleteditems', label: 'Verwijderde items', kind: 'trash' },
];

/** Een map uit de app: de inbox op zijn vaste naam, de rest op het id van Graph. */
function folderPath(folder: string): string {
  return `${API}/mailFolders/${encodeURIComponent(folder || INBOX_FOLDER)}`;
}

const LIST_FIELDS = 'id,subject,bodyPreview,from,receivedDateTime,isRead';
const MESSAGE_FIELDS = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,body,conversationId,flag,hasAttachments';

/**
 * De bijlagen van één bericht. Plaatjes in de tekst zelf hebben een Content-ID
 * nodig om ze te kunnen tonen; dat vraagt Graph alleen per bijlage, dus dat
 * gebeurt alleen voor die plaatjes.
 */
async function messageAttachments(accessToken: string, messageId: string) {
  const path = `${API}/messages/${encodeURIComponent(messageId)}/attachments`;
  const list = await apiFetch(`${path}?$select=id,name,contentType,size,isInline`, accessToken);

  return Promise.all(
    (list.value || []).map(async (item: any): Promise<MailAttachment & { cid: string }> => {
      let cid = '';
      if (item.isInline) {
        const full = await apiFetch(`${path}/${encodeURIComponent(item.id)}`, accessToken).catch(() => null);
        cid = full?.contentId || '';
      }
      return {
        id: item.id,
        name: item.name || 'bijlage',
        mimeType: item.contentType || 'application/octet-stream',
        size: item.size || 0,
        inline: !!item.isInline && !!cid,
        cid,
      };
    })
  );
}

/** De berichten van het gesprek waar dit bericht bij hoort, oudste eerst. */
async function conversation(accessToken: string, id: string) {
  const message = await apiFetch(`${API}/messages/${encodeURIComponent(id)}?$select=conversationId,subject`, accessToken);

  // Sorteren kan Graph niet samen met dit filter; dat doen we zelf
  const filter = encodeURIComponent(`conversationId eq '${message.conversationId.replace(/'/g, "''")}'`);
  const result = await apiFetch(`${API}/messages?$filter=${filter}&$select=${MESSAGE_FIELDS}&$top=50`, accessToken, {
    headers: { Prefer: 'outlook.body-content-type="html"' },
  });

  const messages: any[] = (result.value || []).sort(
    (a: any, b: any) => Date.parse(a.receivedDateTime) - Date.parse(b.receivedDateTime)
  );

  return { subject: message.subject as string, messages };
}

export const microsoft: MailProvider = {
  authorizeUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: credentials().clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPES.join(' '),
      prompt: 'select_account',
      state,
    });
    return `${AUTHORITY}/authorize?${params}`;
  },

  exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = credentials();
    return requestTokens(`${AUTHORITY}/token`, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' '),
    });
  },

  refresh(refreshToken) {
    const { clientId, clientSecret } = credentials();
    return requestTokens(`${AUTHORITY}/token`, {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: SCOPES.join(' '),
    });
  },

  async address(accessToken) {
    const me = await apiFetch(`${API}?$select=mail,userPrincipalName`, accessToken);
    return me.mail || me.userPrincipalName;
  },

  async list(accessToken, { folder, category, unreadOnly, search, pageToken }) {
    // De volgende pagina is een volledig adres van Graph; alleen dat accepteren
    let url: string;
    if (pageToken) {
      if (!pageToken.startsWith(`${API}/`)) throw new Error('Ongeldige pagina');
      url = pageToken;
    } else if (search?.trim()) {
      // Zoeken gaat door alle mail heen. Graph kan zoeken niet combineren met
      // sorteren of filteren; de uitkomst komt al op relevantie
      const params = new URLSearchParams({
        $top: '25',
        $select: LIST_FIELDS,
        $search: `"${search.trim().replace(/"/g, '')}"`,
      });
      url = `${API}/messages?${params}`;
    } else {
      const params = new URLSearchParams({
        $top: '25',
        $select: LIST_FIELDS,
        $orderby: 'receivedDateTime desc',
      });
      // De inbox per tabblad, zoals Outlook hem indeelt in Prioriteit en Overige
      const tab =
        folder === INBOX_FOLDER && category && MAIL_CATEGORIES.microsoft.some(c => c.id === category)
          ? `inferenceClassification eq '${category}'`
          : '';
      const filters = [tab, unreadOnly ? 'isRead eq false' : ''].filter(Boolean);
      // Graph wil het veld waarop gesorteerd wordt ook vooraan in het filter
      if (filters.length) params.set('$filter', ['receivedDateTime ge 1900-01-01T00:00:00Z', ...filters].join(' and '));
      url = `${folderPath(folder)}/messages?${params}`;
    }

    const page = await apiFetch(url, accessToken);

    return {
      items: (page.value || []).map((message: any) => ({
        id: message.id,
        subject: message.subject || '(geen onderwerp)',
        from: toAddress(message.from),
        snippet: message.bodyPreview || '',
        date: message.receivedDateTime,
        unread: !message.isRead,
      })),
      nextPageToken: page['@odata.nextLink'] || null,
    };
  },

  async folders(accessToken) {
    const fields = '$select=id,displayName,unreadItemCount';

    // Welke map welke vaste map is, vraagt Graph per naam; het archief
    // bestaat niet in elke mailbox
    const [known, top, underInbox] = await Promise.all([
      Promise.all(
        WELL_KNOWN.map(folder =>
          apiFetch(`${API}/mailFolders/${folder.name}?${fields}`, accessToken).catch(() => null)
        )
      ),
      apiFetch(`${API}/mailFolders?${fields}&$top=100`, accessToken),
      // Eigen mappen staan vaak onder de inbox
      apiFetch(`${API}/mailFolders/inbox/childFolders?${fields}&$top=100`, accessToken).catch(() => ({ value: [] })),
    ]);

    const knownIds = new Set<string>();
    const system: MailFolder[] = [];
    known.forEach((folder, i) => {
      if (!folder) return;
      knownIds.add(folder.id);
      system.push({
        id: WELL_KNOWN[i].name === 'inbox' ? INBOX_FOLDER : folder.id,
        name: WELL_KNOWN[i].label,
        kind: WELL_KNOWN[i].kind,
        unread: Number(folder.unreadItemCount) || 0,
      });
    });

    // Mappen van Outlook zelf die geen mail bevatten, zoals Gesprekgeschiedenis
    // en Postvak UIT, laten we weg
    const hidden = /^(outbox|postvak uit|conversation history|gespreksgeschiedenis|sync issues|synchronisatieproblemen|rss.*)$/i;

    const own: MailFolder[] = [...(top.value || []), ...(underInbox.value || [])]
      .filter((folder: any) => !knownIds.has(folder.id) && !hidden.test(folder.displayName))
      .map((folder: any) => ({
        id: folder.id,
        name: folder.displayName,
        kind: 'custom' as const,
        unread: Number(folder.unreadItemCount) || 0,
      }))
      .sort((a: MailFolder, b: MailFolder) => a.name.localeCompare(b.name, 'nl'));

    return [...system, ...own];
  },

  async unreadCount(accessToken) {
    const inbox = await apiFetch(`${API}/mailFolders/inbox?$select=unreadItemCount`, accessToken);
    return Number(inbox.unreadItemCount) || 0;
  },

  async signature() {
    // Microsoft Graph geeft de handtekening uit Outlook niet vrij
    return '';
  },

  async thread(accessToken, id) {
    const { subject, messages } = await conversation(accessToken, id);

    const withAttachments = await Promise.all(
      messages.map(async (message: any) => ({
        message,
        attachments: message.hasAttachments ? await messageAttachments(accessToken, message.id) : [],
      }))
    );

    return {
      id,
      subject: subject || '(geen onderwerp)',
      messages: withAttachments.map(({ message, attachments }) => {
        // Plaatjes in de tekst wijzen naar hun bijlage, via onze eigen route
        const cidUrls = Object.fromEntries(
          attachments.filter(a => a.cid).map(a => [a.cid, attachmentUrl(message.id, a.id)])
        );

        return {
          id: message.id,
          from: toAddress(message.from),
          to: (message.toRecipients || []).map(toAddress),
          cc: (message.ccRecipients || []).map(toAddress),
          date: message.receivedDateTime,
          html:
            message.body?.contentType === 'text'
              ? textToHtml(message.body.content || '')
              : replaceCidImages(message.body?.content || '', cidUrls),
          starred: message.flag?.flagStatus === 'flagged',
          attachments: attachments.map(({ cid: _cid, ...attachment }) => attachment),
        };
      }),
    };
  },

  async markRead(accessToken, id) {
    const { messages } = await conversation(accessToken, id);

    await Promise.all(
      messages
        .filter((message: any) => !message.isRead)
        .map((message: any) =>
          apiFetch(`${API}/messages/${encodeURIComponent(message.id)}`, accessToken, {
            method: 'PATCH',
            body: JSON.stringify({ isRead: true }),
          })
        )
    );
  },

  async markUnread(accessToken, id) {
    // Zoals Outlook zelf: alleen dit bericht, niet het hele gesprek
    await apiFetch(`${API}/messages/${encodeURIComponent(id)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: false }),
    });
  },

  async setSpam(accessToken, id, spam) {
    await apiFetch(`${API}/messages/${encodeURIComponent(id)}/move`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ destinationId: spam ? 'junkemail' : 'inbox' }),
    });
  },

  async reply(accessToken, id, html, ownAddress) {
    const { messages } = await conversation(accessToken, id);

    // Op het laatste bericht dat niet van jezelf is; anders op het laatste
    const others = messages.filter(
      (message: any) => toAddress(message.from).email.toLowerCase() !== ownAddress.toLowerCase()
    );
    const target = others[others.length - 1] || messages[messages.length - 1];
    if (!target) throw new Error('Dit gesprek bestaat niet meer');

    // Graph zet het antwoord boven het geciteerde bericht en bewaart het in Verzonden
    await apiFetch(`${API}/messages/${encodeURIComponent(target.id)}/reply`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ comment: html }),
    });
  },

  async archive(accessToken, id) {
    await apiFetch(`${API}/messages/${encodeURIComponent(id)}/move`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ destinationId: 'archive' }),
    });
  },

  async trash(accessToken, id) {
    // Naar Verwijderde items, niet meteen weg; zo doet Outlook het zelf ook
    await apiFetch(`${API}/messages/${encodeURIComponent(id)}/move`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ destinationId: 'deleteditems' }),
    });
  },

  async attachment(accessToken, messageId, attachmentId) {
    const item = await apiFetch(
      `${API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      accessToken
    );

    // Een doorgestuurde mail of agenda-item als bijlage heeft geen bestand
    if (!item.contentBytes) throw new Error('Dit soort bijlage kan alleen in Outlook zelf worden geopend');

    return {
      name: item.name || 'bijlage',
      mimeType: item.contentType || 'application/octet-stream',
      data: Buffer.from(item.contentBytes, 'base64'),
    };
  },

  async setStarred(accessToken, messageId, starred) {
    // Outlook kent geen ster; het dichtstbij is de vlag
    await apiFetch(`${API}/messages/${encodeURIComponent(messageId)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ flag: { flagStatus: starred ? 'flagged' : 'notFlagged' } }),
    });
  },

  async compose(accessToken, to, subject, html, _ownAddress, copies) {
    const recipients = (addresses: string[] = []) => addresses.map(address => ({ emailAddress: { address } }));
    // saveToSentItems: dan staat hij gewoon in Verzonden in Outlook
    await apiFetch(`${API}/sendMail`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: recipients(to),
          ccRecipients: recipients(copies?.cc),
          bccRecipients: recipients(copies?.bcc),
        },
        saveToSentItems: true,
      }),
    });
  },

  async forward(accessToken, _threadId, messageId, to, html) {
    // Graph zet het origineel er zelf onder, met bijlagen en al
    await apiFetch(`${API}/messages/${encodeURIComponent(messageId)}/forward`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        comment: html,
        toRecipients: to.map(address => ({ emailAddress: { address } })),
      }),
    });
  },

  async events(accessToken, from, to) {
    const params = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      $select: 'id,subject,start,end,isAllDay,location,webLink,isCancelled,bodyPreview',
      $orderby: 'start/dateTime',
      $top: '250',
    });

    const events: CalendarEvent[] = [];
    let url: string | null = `${API}/calendarView?${params}`;

    // Alle tijden in UTC, zodat het scherm ze zelf naar de eigen tijdzone omzet
    for (let page = 0; url && page < 5; page++) {
      const data: any = await apiFetch(url, accessToken, { headers: { Prefer: 'outlook.timezone="UTC"' } });

      (data.value || [])
        .filter((item: any) => !item.isCancelled)
        .forEach((item: any) => {
          const allDay = !!item.isAllDay;
          // Een hele dag komt als middernacht; alleen de datum telt dan
          const time = (value: string) => (allDay ? value.slice(0, 10) : `${value.replace(/\.\d+$/, '')}Z`);
          events.push({
            id: item.id,
            title: item.subject || '(geen titel)',
            start: time(item.start.dateTime),
            end: time(item.end.dateTime),
            allDay,
            location: item.location?.displayName || '',
            description: item.bodyPreview || '',
            url: item.webLink || null,
          });
        });

      url = data['@odata.nextLink'] || null;
    }

    return events;
  },

  async createEvent(accessToken, event) {
    await apiFetch(`${API}/events`, accessToken, { method: 'POST', body: JSON.stringify(toGraphEvent(event)) });
  },

  async updateEvent(accessToken, id, event) {
    await apiFetch(`${API}/events/${encodeURIComponent(id)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(toGraphEvent(event)),
    });
  },

  async deleteEvent(accessToken, id) {
    await apiFetch(`${API}/events/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
  },

  async revoke() {
    // Microsoft kent geen intrekken per sleutel; we gooien de sleutels weg
  },
};
