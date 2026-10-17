import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getVatOverview } from '@/lib/db';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Het btw-overzicht over een periode: GET ?from=jjjj-mm-dd&to=jjjj-mm-dd,
 * beide dagen meegerekend. Zie getVatOverview voor wat er meetelt.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { from, to } = req.query;

  if (typeof from !== 'string' || typeof to !== 'string' || !DATE.test(from) || !DATE.test(to)) {
    return res.status(400).json({ error: 'Kies een periode' });
  }

  try {
    return res.status(200).json(await getVatOverview(tenantId, from, to));
  } catch (error: any) {
    console.error('VAT overview error:', error);
    return res.status(500).json({ error: error.message || 'Het btw-overzicht kon niet geladen worden' });
  }
}
