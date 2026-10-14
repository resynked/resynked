import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { AiKeyError, aiProvider, deleteAiAccount, getAiAccount, isAiProvider, saveAiAccount } from '@/lib/ai';

/**
 * De AI-koppeling van wie er ingelogd is. GET zegt welke dienst er aan staat,
 * POST { provider, apiKey } controleert de sleutel en bewaart hem, DELETE haalt
 * hem weg. De sleutel komt hier nooit meer naar buiten.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const user = session.user as any;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ account: await getAiAccount(user.id) });
    }

    if (req.method === 'POST') {
      const { provider, apiKey } = req.body || {};
      if (!isAiProvider(provider)) return res.status(400).json({ error: 'Onbekende AI-dienst' });

      const key = String(apiKey || '').trim();
      if (!key) return res.status(400).json({ error: 'Vul je API-sleutel in' });

      // Eerst proberen, zodat een tikfout meteen opvalt en niet pas bij de eerste mail
      await aiProvider(provider).verifyKey(key);
      await saveAiAccount(user.id, user.tenantId, provider, key);
      return res.status(200).json({ account: { provider } });
    }

    if (req.method === 'DELETE') {
      await deleteAiAccount(user.id);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof AiKeyError) return res.status(400).json({ error: error.message });
    console.error('AI-koppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
