import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getProduct, updateProduct, deleteProduct } from '@/lib/db';

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
      const product = await getProduct(id, tenantId);
      return res.status(200).json(product);
    }

    if (req.method === 'PUT') {
      const { name, description, price, stock, image_url } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = parseFloat(price);
      if (stock !== undefined) updates.stock = stock;
      if (image_url !== undefined) updates.image_url = image_url;

      const product = await updateProduct(id, tenantId, updates);
      return res.status(200).json(product);
    }

    if (req.method === 'DELETE') {
      await deleteProduct(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
}
