import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getBankTransactions } from '@/lib/bank';

/** De banktransacties, nieuwste eerst: GET, of ?open=1 voor alleen wat nog te verwerken is */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.status(200).json(await getBankTransactions((session.user as any).tenantId, req.query.open === '1'));
  } catch (error: any) {
    console.error('Bank transactions error:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
