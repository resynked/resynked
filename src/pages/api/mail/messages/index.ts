import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { INBOX_FOLDER, openMailbox, sendMailError, withSignature } from '@/lib/mail';
import { isEmailAddress } from '@/lib/email';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/richtext';

/**
 * De inbox, een pagina tegelijk. Wordt rechtstreeks bij Gmail of Outlook
 * opgehaald; er wordt niets van de mail bij ons bewaard.
 *
 * ?folder=... welke map (standaard de inbox), ?q=... zoeken in alle mail,
 * ?unread=1 alleen ongelezen, ?page=... de volgende pagina.
 *
 * POST verstuurt een nieuw bericht: { to: ['iemand@voorbeeld.nl'], cc, bcc, subject, html }.
 * Het gaat via Gmail of Outlook zelf, met de handtekening eronder.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') return compose(req, res, (session.user as any).id);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);
    const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

    const page = await provider.list(accessToken, {
      folder: text(req.query.folder) || INBOX_FOLDER,
      search: text(req.query.q),
      unreadOnly: req.query.unread === '1',
      pageToken: typeof req.query.page === 'string' && req.query.page ? req.query.page : undefined,
    });

    return res.status(200).json(page);
  } catch (error) {
    return sendMailError(res, error);
  }
}

/** Een lijst adressen uit het verzoek, zonder lege regels */
const addressList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).map((address: unknown) => String(address).trim()).filter(Boolean);

async function compose(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const recipients = addressList(req.body?.to);
  if (recipients.length === 0) return res.status(400).json({ error: 'Vul in naar wie het bericht moet' });

  const cc = addressList(req.body?.cc);
  const bcc = addressList(req.body?.bcc);
  const invalid = [...recipients, ...cc, ...bcc].find(address => !isEmailAddress(address));
  if (invalid) return res.status(400).json({ error: `${invalid} is geen geldig e-mailadres` });

  const subject = String(req.body?.subject || '').trim();
  const html = sanitizeRichText(String(req.body?.html || ''));
  if (isRichTextEmpty(html)) return res.status(400).json({ error: 'Je bericht is nog leeg' });

  try {
    const { provider, accessToken, email } = await openMailbox(userId);
    const signature = await provider.signature(accessToken, email).catch(() => '');
    await provider.compose(accessToken, recipients, subject || '(geen onderwerp)', withSignature(html, signature), email, { cc, bcc });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendMailError(res, error);
  }
}
