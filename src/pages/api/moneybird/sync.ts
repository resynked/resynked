import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getMoneybirdAccount, pushOpenInvoicesToMoneybird } from '@/lib/moneybird';

/**
 * Vastgelegde facturen die nog niet in Moneybird staan erin zetten: POST.
 * Voor facturen van vóór de koppeling, en voor wat eerder niet lukte. Doet
 * een stuk per keer; met more: true roept het scherm hem nog eens aan.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (!(await getMoneybirdAccount(tenantId))) {
      return res.status(400).json({ error: 'Moneybird is niet gekoppeld' });
    }
    return res.status(200).json(await pushOpenInvoicesToMoneybird(tenantId));
  } catch (error: any) {
    console.error('Moneybird sync error:', error);
    return res.status(500).json({ error: error.message || 'Overzetten mislukt' });
  }
}
