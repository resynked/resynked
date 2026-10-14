import type { MailAddress, MailProvider } from './types';
import { apiFetch, requestTokens, textToHtml } from './utils';

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

const SCOPES = ['openid', 'email', 'offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'];

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

const LIST_FIELDS = 'id,subject,bodyPreview,from,receivedDateTime,isRead';
const MESSAGE_FIELDS = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,body,conversationId';

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

  async list(accessToken, { unreadOnly, pageToken }) {
    // De volgende pagina is een volledig adres van Graph; alleen dat accepteren
    let url: string;
    if (pageToken) {
      if (!pageToken.startsWith(`${API}/`)) throw new Error('Ongeldige pagina');
      url = pageToken;
    } else {
      const params = new URLSearchParams({
        $top: '25',
        $select: LIST_FIELDS,
        $orderby: 'receivedDateTime desc',
      });
      // Graph wil het veld waarop gesorteerd wordt ook vooraan in het filter
      if (unreadOnly) params.set('$filter', 'receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false');
      url = `${API}/mailFolders/inbox/messages?${params}`;
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

  async thread(accessToken, id) {
    const { subject, messages } = await conversation(accessToken, id);

    return {
      id,
      subject: subject || '(geen onderwerp)',
      messages: messages.map((message: any) => ({
        id: message.id,
        from: toAddress(message.from),
        to: (message.toRecipients || []).map(toAddress),
        cc: (message.ccRecipients || []).map(toAddress),
        date: message.receivedDateTime,
        html: message.body?.contentType === 'text' ? textToHtml(message.body.content || '') : message.body?.content || '',
      })),
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

  async revoke() {
    // Microsoft kent geen intrekken per sleutel; we gooien de sleutels weg
  },
};
