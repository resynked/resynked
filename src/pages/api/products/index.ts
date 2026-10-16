import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createProduct, getProducts, validateProduct } from '@/lib/db';

/** De producten van het bedrijf: GET de lijst op naam, POST { name, unit, price } voegt er een toe. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') return res.status(200).json(await getProducts(tenantId));

    if (req.method === 'POST') {
      const product = validateProduct(req.body);
      if (typeof product === 'string') return res.status(400).json({ error: product });
      return res.status(201).json(await createProduct(tenantId, product));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Products error:', error);
    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
