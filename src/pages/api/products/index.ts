import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getProducts, createProduct } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const products = await getProducts(tenantId);
      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const { name, description, price, stock, image_url } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      const product = await createProduct({
        tenant_id: tenantId,
        name,
        description: description || null,
        price: parseFloat(price),
        stock: stock || 0,
        image_url: image_url || null,
      });

      return res.status(201).json(product);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
