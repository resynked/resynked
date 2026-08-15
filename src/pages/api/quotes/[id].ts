import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuote, updateQuote, deleteQuote } from '@/lib/db';
import { calculateDocumentTotal } from '@/lib/utils';
import { validateBlocks } from '@/lib/blocks';

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
        intro_text,
        notes,
        blocks,
        autosave,
      } = req.body;

      const updates: any = {};
      if (customer_id !== undefined) updates.customer_id = customer_id;
      if (quote_number !== undefined) updates.quote_number = quote_number;
      if (quote_date !== undefined) updates.quote_date = quote_date;
      if (valid_until !== undefined) updates.valid_until = valid_until;
      if (status !== undefined) updates.status = status;
      if (currency !== undefined) updates.currency = currency;
      if (intro_text !== undefined) updates.intro_text = intro_text;
      if (notes !== undefined) updates.notes = notes;

      // Het totaal wordt hier herrekend zodat het altijd bij de blokken past
      if (blocks !== undefined) {
        // Automatisch opslaan gebeurt terwijl iemand nog bezig is; een tabel
        // zonder regels mag het bewaren dan niet tegenhouden, anders gaat juist
        // het werk verloren dat we wilden veiligstellen. De controle hoort bij
        // het bewust bijwerken.
        if (!autosave) {
          const problem = validateBlocks(blocks);
          if (problem) {
            return res.status(400).json({ error: problem });
          }
        }
        updates.total = calculateDocumentTotal(blocks);
      }

      const quote = await updateQuote(id, tenantId, updates, blocks);
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
