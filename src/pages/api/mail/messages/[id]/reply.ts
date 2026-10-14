import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/richtext';

/**
 * Antwoorden op een gesprek. Het antwoord gaat via Gmail of Outlook zelf de
 * deur uit, dus het staat daar ook in Verzonden en onder hetzelfde gesprek.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'Invalid ID' });

  // Alleen de opmaak die de editor kent, zodat er niets vreemds mee de mail in gaat
  const html = sanitizeRichText(String(req.body?.html || ''));
  if (isRichTextEmpty(html)) return res.status(400).json({ error: 'Je antwoord is nog leeg' });

  try {
    const { provider, accessToken, email } = await openMailbox((session.user as any).id);
    await provider.reply(accessToken, id, html, email);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendMailError(res, error);
  }
}
