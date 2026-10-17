import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { linkTransaction, type TransactionLink } from '@/lib/bank';

/**
 * Een transactie koppelen: PUT { invoiceId } of { expenseId } of { category },
 * of {} om de koppeling weg te halen. Zie linkTransaction.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  const body = req.body || {};
  const link: TransactionLink = body.invoiceId
    ? { invoiceId: Number(body.invoiceId) }
    : body.expenseId
      ? { expenseId: Number(body.expenseId) }
      : body.category
        ? { category: String(body.category) }
        : null;

  try {
    return res.status(200).json(await linkTransaction(tenantId, id, link));
  } catch (error: any) {
    console.error('Bank link error:', error);
    return res.status(400).json({ error: error.message || 'Koppelen mislukt' });
  }
}
