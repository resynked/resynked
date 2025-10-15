import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuote, updateQuote, deleteQuote } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    if (req.method === 'GET') {
      const quote = await getQuote(id, tenantId);
      return res.status(200).json(quote);
    }

    if (req.method === 'PUT') {
      const updates = req.body;
      const quote = await updateQuote(id, tenantId, updates);
      return res.status(200).json(quote);
    }

    if (req.method === 'DELETE') {
      await deleteQuote(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
