import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { syncBankAccounts } from '@/lib/gocardless';

/** Nu de nieuwe transacties ophalen bij de gekoppelde bank: POST */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.status(200).json(await syncBankAccounts((session.user as any).tenantId));
  } catch (error: any) {
    console.error('Bank sync error:', error);
    const expired = error.status === 401 || error.status === 403;
    return res.status(400).json({
      error: expired
        ? 'De toestemming bij je bank is verlopen. Koppel je bank opnieuw bij Plug-ins.'
        : error.status === 429
          ? 'Je bank staat maar een paar keer per dag ophalen toe. Probeer het later opnieuw.'
          : error.message || 'Ophalen mislukt',
    });
  }
}
