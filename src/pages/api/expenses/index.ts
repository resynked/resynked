import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createExpense, getExpenses } from '@/lib/db';
import { expenseFromBody } from '@/lib/expenses';

// Het bonnetje komt als data-URL mee; groter dan de standaardgrens van 1 MB
export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await getExpenses(tenantId));
    }

    if (req.method === 'POST') {
      const { fields, lines, problem } = expenseFromBody(req.body);
      if (problem) return res.status(400).json({ error: problem });

      const expense = await createExpense(tenantId, fields as any, lines!, req.body.file || null);
      return res.status(201).json(expense);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
