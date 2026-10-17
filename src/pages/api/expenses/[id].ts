import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { deleteExpense, getExpense, updateExpense } from '@/lib/db';
import { expenseFromBody } from '@/lib/expenses';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await getExpense(id, tenantId));
    }

    if (req.method === 'PUT') {
      const { fields, lines, problem } = expenseFromBody(req.body);
      if (problem) return res.status(400).json({ error: problem });

      // file: een nieuw bestand, null om het weg te halen, weggelaten om het te houden
      const expense = await updateExpense(id, tenantId, fields, lines, req.body.file);
      return res.status(200).json(expense);
    }

    if (req.method === 'DELETE') {
      await deleteExpense(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
