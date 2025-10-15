import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuotes, createQuote } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const quotes = await getQuotes(tenantId);
      return res.status(200).json(quotes);
    }

    if (req.method === 'POST') {
      const { customer_id, quote_number, quote_date, valid_until, currency, tax_percentage, discount_percentage, notes, items } = req.body;

      if (!customer_id || !quote_number || !quote_date || !valid_until || !items || items.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Calculate total
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const discount = subtotal * ((discount_percentage || 0) / 100);
      const taxableAmount = subtotal - discount;
      const tax = taxableAmount * ((tax_percentage || 21) / 100);
      const total = taxableAmount + tax;

      const quote = await createQuote(
        {
          tenant_id: tenantId,
          customer_id,
          quote_number,
          quote_date,
          valid_until,
          total,
          status: 'draft',
          currency: currency || 'EUR',
          tax_percentage: tax_percentage || 21,
          discount_percentage: discount_percentage || 0,
          notes: notes || null,
        },
        items
      );

      return res.status(201).json(quote);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
