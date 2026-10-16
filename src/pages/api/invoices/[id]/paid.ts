import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { updateInvoice } from '@/lib/db';

/**
 * Een factuur als betaald markeren, of dat terugdraaien: POST { paid }.
 * Voor betalingen die buiten Khance binnenkomen, zoals een overschrijving met
 * de QR-code. De betaaldatum gaat mee (zie updateInvoice); daarop telt de omzet.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    // Terug van betaald is weer openstaand, nooit concept: een factuur die
    // ooit als betaald stond, ligt vast (zie lib/invoices)
    const status = req.body?.paid === false ? 'sent' : 'paid';
    const updated = await updateInvoice(id, tenantId, { status });
    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('Mark paid error:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
