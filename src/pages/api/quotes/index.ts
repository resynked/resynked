import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuotes, createQuote } from '@/lib/db';
import { calculateDocumentTotal } from '@/lib/utils';
import { validateBlocks } from '@/lib/blocks';

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
        intro_text,
        notes,
        blocks,
      } = req.body;

      if (!customer_id || !quote_number || !quote_date || !valid_until) {
        return res.status(400).json({ error: 'Vul offertenummer, datum, geldigheidsdatum en klant in' });
      }

      const problem = validateBlocks(blocks);
      if (problem) {
        return res.status(400).json({ error: problem });
      }

      const quote = await createQuote(
        {
          tenant_id: tenantId,
          customer_id,
          quote_number,
          quote_date,
          valid_until,
          total: calculateDocumentTotal(blocks),
          status: 'draft',
          currency: currency || 'EUR',
          intro_text: intro_text || null,
          notes: notes || null,
        },
        blocks
      );

      return res.status(201).json(quote);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
