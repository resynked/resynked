import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getExpense } from '@/lib/db';
import { downloadDocument } from '@/lib/storage';

/**
 * Het bonnetje of de inkoopfactuur bij een kostenpost, om te bekijken. Alleen
 * na inloggen en alleen van het eigen bedrijf; de opslag zelf is afgeschermd.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    const expense = await getExpense(id, tenantId);
    if (!expense.file_path) return res.status(404).json({ error: 'Geen bestand bij deze kostenpost' });

    const { buffer, type } = await downloadDocument(tenantId, expense.file_path);
    res.setHeader('Content-Type', expense.file_type || type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(expense.file_name || 'bestand')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(buffer);
  } catch (error: any) {
    return res.status(404).json({ error: error.message || 'Bestand niet gevonden' });
  }
}
