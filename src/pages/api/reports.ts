import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getAnnualFigures } from '@/lib/ledger';

/** De jaarcijfers van een jaar: GET ?year=2026. Zie getAnnualFigures. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ error: 'Kies een jaar' });

  try {
    return res.status(200).json(await getAnnualFigures((session.user as any).tenantId, year));
  } catch (error: any) {
    console.error('Annual figures error:', error);
    return res.status(500).json({ error: error.message || 'De jaarcijfers konden niet berekend worden' });
  }
}
