import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getInvoice, updateInvoice, deleteInvoice } from '@/lib/db';

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
      const invoice = await getInvoice(id, tenantId);
      return res.status(200).json(invoice);
    }

    if (req.method === 'PUT') {
      const { customer_id, total, status } = req.body;

      const updates: any = {};
      if (customer_id !== undefined) updates.customer_id = customer_id;
      if (total !== undefined) updates.total = parseFloat(total);
      if (status !== undefined) updates.status = status;

      const invoice = await updateInvoice(id, tenantId, updates);
      return res.status(200).json(invoice);
    }

    if (req.method === 'DELETE') {
      await deleteInvoice(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
