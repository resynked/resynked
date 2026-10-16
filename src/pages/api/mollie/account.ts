import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { MollieKeyError, deleteMollieAccount, getMollieAccount, saveMollieAccount, verifyMollieKey } from '@/lib/mollie';

/**
 * De Mollie-koppeling van het bedrijf. GET zegt of hij aan staat (en of het
 * een testsleutel is), POST { apiKey } controleert de sleutel en bewaart hem,
 * DELETE haalt hem weg. De sleutel komt hier nooit meer naar buiten.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ account: await getMollieAccount(tenantId) });
    }

    if (req.method === 'POST') {
      const key = String(req.body?.apiKey || '').trim();
      if (!key) return res.status(400).json({ error: 'Vul je API-sleutel in' });

      // Eerst proberen, zodat een tikfout meteen opvalt en niet pas bij een klant
      await verifyMollieKey(key);
      await saveMollieAccount(tenantId, key);
      return res.status(200).json({ account: { test: key.startsWith('test_') } });
    }

    if (req.method === 'DELETE') {
      await deleteMollieAccount(tenantId);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof MollieKeyError) return res.status(400).json({ error: error.message });
    console.error('Mollie-koppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
