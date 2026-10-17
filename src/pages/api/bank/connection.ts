import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { deleteBankConnection, getBankConnection, isBankLinkConfigured, listInstitutions, startBankConnection } from '@/lib/gocardless';

/**
 * De bankkoppeling van het bedrijf. GET zegt of het platform hem aanbiedt,
 * hoe hij er nu voor staat en welke banken er zijn; POST { institutionId }
 * geeft de link naar de bank om toestemming te geven; DELETE haalt hem weg.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      if (!isBankLinkConfigured()) return res.status(200).json({ configured: false, connection: null, institutions: [] });
      const [connection, institutions] = await Promise.all([getBankConnection(tenantId), listInstitutions()]);
      return res.status(200).json({ configured: true, connection, institutions });
    }

    if (req.method === 'POST') {
      const institutionId = String(req.body?.institutionId || '');
      if (!institutionId) return res.status(400).json({ error: 'Kies je bank' });
      return res.status(200).json({ link: await startBankConnection(tenantId, institutionId) });
    }

    if (req.method === 'DELETE') {
      await deleteBankConnection(tenantId);
      return res.status(200).json({ connection: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Bank connection error:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
