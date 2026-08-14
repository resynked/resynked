import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuote, updateQuote, deleteQuote } from '@/lib/db';
import { calculateTotals } from '@/lib/utils';

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
      const {
        customer_id,
        quote_number,
        quote_date,
        valid_until,
        status,
        currency,
        tax_percentage,
        discount_percentage,
        notes,
        items,
      } = req.body;

      if (Array.isArray(items) && items.some((item: any) => !item.description?.trim())) {
        return res.status(400).json({ error: 'Elke regel heeft een omschrijving nodig' });
      }

      const updates: any = {};
      if (customer_id !== undefined) updates.customer_id = customer_id;
      if (quote_number !== undefined) updates.quote_number = quote_number;
      if (quote_date !== undefined) updates.quote_date = quote_date;
      if (valid_until !== undefined) updates.valid_until = valid_until;
      if (status !== undefined) updates.status = status;
      if (currency !== undefined) updates.currency = currency;
      if (tax_percentage !== undefined) updates.tax_percentage = tax_percentage;
      if (discount_percentage !== undefined) updates.discount_percentage = discount_percentage;
      if (notes !== undefined) updates.notes = notes;

      // Het totaal wordt hier herrekend zodat het altijd bij de regels past
      if (Array.isArray(items)) {
        const existing = await getQuote(id, tenantId);
        const { total } = calculateTotals(
          items,
          tax_percentage ?? existing.tax_percentage,
          discount_percentage ?? existing.discount_percentage
        );
        updates.total = total;
      }

      const quote = await updateQuote(id, tenantId, updates, items);
      return res.status(200).json(quote);
    }

    if (req.method === 'DELETE') {
      await deleteQuote(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
