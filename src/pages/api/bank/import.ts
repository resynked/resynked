import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { importStatement } from '@/lib/bank';

// Een afschrift van een kwartaal kan al snel groter zijn dan de standaardgrens van 1 MB
export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

/**
 * Een bankafschrift inlezen: POST { content } met de tekst van een CAMT.053-
 * of MT940-bestand. Nieuwe transacties worden bewaard en waar het zeker is
 * meteen aan een factuur of kostenpost gekoppeld.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    const content = String(req.body?.content || '');
    if (!content.trim()) return res.status(400).json({ error: 'Kies een afschrift' });
    return res.status(200).json(await importStatement(tenantId, content));
  } catch (error: any) {
    console.error('Bank import error:', error);
    return res.status(400).json({ error: error.message || 'Het afschrift kon niet ingelezen worden' });
  }
}
