import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getNotes, createNote } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const { customer_id } = req.query;
      const customerId = customer_id ? parseInt(customer_id as string) : undefined;

      const notes = await getNotes(tenantId, customerId);
      return res.status(200).json(notes);
    }

    if (req.method === 'POST') {
      const { customer_id, title, content } = req.body;

      if (!customer_id || !title || !content) {
        return res.status(400).json({ error: 'Customer ID, title, and content are required' });
      }

      const note = await createNote({
        tenant_id: tenantId,
        customer_id: parseInt(customer_id),
        title,
        content,
      });

      return res.status(201).json(note);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
