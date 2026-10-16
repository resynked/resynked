import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { createCreditNote } from '@/lib/db';

/**
 * Een creditfactuur maken bij een verstuurde factuur: POST. Komt terug als
 * concept met alle regels in min, om eventueel nog in te korten.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    const creditNote = await createCreditNote(id, tenantId);
    return res.status(201).json(creditNote);
  } catch (error: any) {
    console.error('Credit note error:', error);
    return res.status(400).json({ error: error.message || 'De creditfactuur kon niet gemaakt worden' });
  }
}
