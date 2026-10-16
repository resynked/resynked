/**
 * Mail van Khance zelf, zoals de link voor een nieuw wachtwoord. Die kan niet
 * via de gekoppelde Gmail of Outlook van de gebruiker: wie zijn wachtwoord kwijt
 * is, is niet ingelogd, en heeft misschien nooit een mailbox gekoppeld.
 *
 * Verstuurd via Resend (resend.com), rechtstreeks met hun API.
 * RESEND_API_KEY is de sleutel uit hun dashboard, EMAIL_FROM het afzendadres
 * op een domein dat daar is geverifieerd, zoals "Khance <noreply@khance.com>".
 */
export async function sendSystemEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Zet RESEND_API_KEY en EMAIL_FROM in de omgevingsvariabelen');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Resend antwoordde met ${response.status}`);
  }
}
