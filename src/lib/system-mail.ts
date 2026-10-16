/**
 * Mail van Khance zelf, zoals de link voor een nieuw wachtwoord. Die kan niet
 * via de gekoppelde Gmail of Outlook van de gebruiker: wie zijn wachtwoord kwijt
 * is, is niet ingelogd, en heeft misschien nooit een mailbox gekoppeld.
 *
 * Verstuurd via Resend (resend.com), rechtstreeks met hun API.
 * RESEND_API_KEY is de sleutel uit hun dashboard. Het afzendadres is
 * EMAIL_FROM, of anders noreply@ op het domein van de app (APP_URL), zoals
 * "Khance <noreply@khance.com>". Dat domein moet bij Resend geverifieerd zijn.
 */
export async function sendSystemEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  /** Waar "Beantwoorden" naartoe gaat, zoals de aanvrager van een demo */
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Zet RESEND_API_KEY in de omgevingsvariabelen');
  const from = process.env.EMAIL_FROM || defaultFrom();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo && { reply_to: replyTo }) }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Resend: ${data.message || `antwoordde met ${response.status}`} (afzender ${from})`);
  }
}

/** noreply@ op het domein van de app, zonder www */
function defaultFrom(): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!url) throw new Error('Zet EMAIL_FROM of APP_URL in de omgevingsvariabelen');
  const host = new URL(url).hostname.replace(/^www\./, '');
  return `Khance <noreply@${host}>`;
}
