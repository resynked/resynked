import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getBankAccounts } from '@/lib/bank';

/** De bankrekeningen van het bedrijf, met hun saldo */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.status(200).json(await getBankAccounts((session.user as any).tenantId));
  } catch (error: any) {
    console.error('Bank accounts error:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
