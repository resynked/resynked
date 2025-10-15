import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getNote, updateNote, deleteNote } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  try {
    if (req.method === 'GET') {
      const note = await getNote(id, tenantId);
      return res.status(200).json(note);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { title, content, customer_id } = req.body;

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (customer_id !== undefined) updates.customer_id = parseInt(customer_id);

      const note = await updateNote(id, tenantId, updates);
      return res.status(200).json(note);
    }

    if (req.method === 'DELETE') {
      await deleteNote(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);

    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
