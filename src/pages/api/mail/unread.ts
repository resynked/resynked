import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';

/** Hoeveel er ongelezen in de inbox staat, voor het getal in de zijbalk. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);
    return res.status(200).json({ count: await provider.unreadCount(accessToken) });
  } catch (error) {
    return sendMailError(res, error);
  }
}
