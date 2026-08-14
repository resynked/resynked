import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuotes, createQuote } from '@/lib/db';
import { calculateTotals } from '@/lib/utils';

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
      const {
        customer_id,
        quote_number,
        quote_date,
        valid_until,
        currency,
        tax_percentage,
        discount_percentage,
        notes,
        items,
      } = req.body;

      if (!customer_id || !quote_number || !quote_date || !valid_until) {
        return res.status(400).json({ error: 'Vul offertenummer, datum, geldigheidsdatum en klant in' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Voeg minimaal één regel toe' });
      }

      if (items.some((item: any) => !item.description?.trim())) {
        return res.status(400).json({ error: 'Elke regel heeft een omschrijving nodig' });
      }

      const taxPercentage = tax_percentage ?? 21;
      const discountPercentage = discount_percentage ?? 0;
      const { total } = calculateTotals(items, taxPercentage, discountPercentage);

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
          tax_percentage: taxPercentage,
          discount_percentage: discountPercentage,
          notes: notes || null,
        },
        items
      );

      return res.status(201).json(quote);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
