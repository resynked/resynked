import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { openMailbox, sendMailError, withSignature } from '@/lib/mail';
import { isEmailAddress } from '@/lib/email';
import { sanitizeRichText } from '@/lib/richtext';

/**
 * Een bericht uit een gesprek doorsturen. Wat je erbij schrijft komt bovenaan,
 * dan je handtekening, en daaronder het origineel.
 *
 * Body: { messageId, to: ['iemand@voorbeeld.nl'], html }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  const { messageId, to } = req.body || {};
  if (typeof id !== 'string' || !id || typeof messageId !== 'string' || !messageId) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const recipients: string[] = (Array.isArray(to) ? to : [])
    .map((address: unknown) => String(address).trim())
    .filter(Boolean);
  if (recipients.length === 0) return res.status(400).json({ error: 'Vul in naar wie het bericht moet' });

  const invalid = recipients.find(address => !isEmailAddress(address));
  if (invalid) return res.status(400).json({ error: `${invalid} is geen geldig e-mailadres` });

  const html = sanitizeRichText(String(req.body?.html || ''));

  try {
    const { provider, accessToken, email } = await openMailbox((session.user as any).id);
    const signature = await provider.signature(accessToken, email).catch(() => '');
    await provider.forward(accessToken, id, messageId, recipients, withSignature(html, signature), email);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendMailError(res, error);
  }
}
