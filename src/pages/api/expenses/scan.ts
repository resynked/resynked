import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { AiKeyError, openAi } from '@/lib/ai';
import { parseDataUrl } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

/**
 * Een bonnetje of inkoopfactuur laten uitlezen door de AI van de gebruiker:
 * POST { file: { data, name } }. Komt terug als voorstel voor het formulier;
 * er wordt nog niets opgeslagen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;

  try {
    const { type, buffer } = parseDataUrl(req.body?.file?.data);
    const ai = await openAi(userId);
    const reading = await ai.provider.readReceipt(ai.apiKey, { base64: buffer.toString('base64'), mediaType: type });
    return res.status(200).json(reading);
  } catch (error: any) {
    if (error instanceof AiKeyError) return res.status(400).json({ error: error.message });
    console.error('Receipt scan error:', error);
    return res.status(400).json({ error: error.message || 'Het bestand kon niet gelezen worden' });
  }
}
