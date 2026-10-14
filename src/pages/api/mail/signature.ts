import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';

/**
 * De handtekening uit Gmail, om onder het antwoord te laten zien. Bij het
 * versturen zet de server hem er zelf onder; dit is alleen om te tonen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { provider, accessToken, email } = await openMailbox((session.user as any).id);
    return res.status(200).json({ html: await provider.signature(accessToken, email).catch(() => '') });
  } catch (error) {
    return sendMailError(res, error);
  }
}
