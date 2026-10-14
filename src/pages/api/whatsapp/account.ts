import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { deleteWhatsAppAccount, getWhatsAppAccount, isWhatsAppConfigured, startLinking, whatsAppConfig } from '@/lib/whatsapp';

/**
 * De WhatsApp-koppeling van wie er ingelogd is. GET zegt welk nummer er
 * gekoppeld is (of welke code nog openstaat) en of de bot is ingesteld, POST
 * maakt een verse koppelcode die je vanaf je telefoon naar de bot stuurt,
 * DELETE haalt de koppeling weg.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const user = session.user as any;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ account: await getWhatsAppAccount(user.id), config: whatsAppConfig() });
    }

    if (req.method === 'POST') {
      if (!isWhatsAppConfigured()) return res.status(409).json({ error: 'WhatsApp is nog niet ingesteld voor Resynked' });
      return res.status(200).json({ account: await startLinking(user.id, user.tenantId) });
    }

    if (req.method === 'DELETE') {
      await deleteWhatsAppAccount(user.id);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('WhatsApp-koppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
