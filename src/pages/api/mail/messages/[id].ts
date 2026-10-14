import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';

/**
 * Eén gesprek. GET haalt het op met alle berichten erin. PATCH markeert het
 * als gelezen, of zet met { messageId, starred } een ster (Gmail) of vlag
 * (Outlook) op één bericht — ook in Gmail of Outlook zelf.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);

    if (req.method === 'GET') {
      return res.status(200).json(await provider.thread(accessToken, id));
    }

    if (req.method === 'PATCH') {
      const { messageId, starred } = req.body || {};

      if (typeof starred === 'boolean') {
        if (typeof messageId !== 'string' || !messageId) return res.status(400).json({ error: 'Invalid message' });
        await provider.setStarred(accessToken, messageId, starred);
        return res.status(200).json({ ok: true });
      }

      await provider.markRead(accessToken, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendMailError(res, error);
  }
}
