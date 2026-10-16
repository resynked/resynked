import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { deleteProduct, updateProduct, validateProduct } from '@/lib/db';

/**
 * Eén product: PUT past hem aan, DELETE haalt hem weg. Offertes en facturen
 * waarin hij al staat veranderen niet mee; die hebben een eigen kopie.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    if (req.method === 'PUT') {
      const product = validateProduct(req.body);
      if (typeof product === 'string') return res.status(400).json({ error: product });
      return res.status(200).json(await updateProduct(id, tenantId, product));
    }

    if (req.method === 'DELETE') {
      await deleteProduct(id, tenantId);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Product error:', error);
    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
