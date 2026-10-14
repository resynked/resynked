import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { deleteMailAccount, getMailAccount } from '@/lib/mail';

/**
 * De gekoppelde mailbox van wie er ingelogd is. GET zegt of er een is (en
 * welk adres), DELETE ontkoppelt hem. Sleutels komen hier nooit naar buiten.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ account: await getMailAccount(userId) });
    }

    if (req.method === 'DELETE') {
      await deleteMailAccount(userId);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Mailkoppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
