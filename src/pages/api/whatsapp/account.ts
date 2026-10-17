import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  deleteWhatsAppAccount,
  getWhatsAppAccount,
  isWhatsAppConfigured,
  saveWhatsAppAccount,
  whatsAppConfig,
  WhatsAppPhoneTakenError,
} from '@/lib/whatsapp';

/**
 * De WhatsApp-koppeling van wie er ingelogd is. GET zegt welk mobiel nummer er
 * gekoppeld is, met de bot van Synbased erbij; POST { phone } koppelt een
 * nummer, DELETE haalt het weg. De token van de bot komt hier nooit heel naar buiten.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const user = session.user as any;

  try {
    if (req.method === 'GET') {
      const [account, config] = await Promise.all([getWhatsAppAccount(user.id), whatsAppConfig()]);
      return res.status(200).json({ account, config });
    }

    if (req.method === 'POST') {
      if (!isWhatsAppConfigured()) return res.status(409).json({ error: 'WhatsApp is nog niet ingesteld voor Synbased' });

      const phone = String(req.body?.phone || '').trim();
      if (phone.replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'Vul je eigen mobiele nummer in' });

      return res.status(200).json({ account: await saveWhatsAppAccount(user.id, user.tenantId, phone) });
    }

    if (req.method === 'DELETE') {
      await deleteWhatsAppAccount(user.id);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof WhatsAppPhoneTakenError) return res.status(400).json({ error: error.message });
    console.error('WhatsApp-koppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
