import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getOrders, createOrder } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const orders = await getOrders(tenantId);
      return res.status(200).json(orders);
    }

    if (req.method === 'POST') {
      const { customer_id, order_number, order_date, currency, tax_percentage, discount_percentage, notes, items } = req.body;

      if (!customer_id || !order_number || !order_date || !items || items.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Calculate total
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const discount = subtotal * ((discount_percentage || 0) / 100);
      const taxableAmount = subtotal - discount;
      const tax = taxableAmount * ((tax_percentage || 21) / 100);
      const total = taxableAmount + tax;

      const order = await createOrder(
        {
          tenant_id: tenantId,
          customer_id,
          order_number,
          order_date,
          total,
          status: 'pending',
          currency: currency || 'EUR',
          tax_percentage: tax_percentage || 21,
          discount_percentage: discount_percentage || 0,
          notes: notes || null,
        },
        items
      );

      return res.status(201).json(order);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
