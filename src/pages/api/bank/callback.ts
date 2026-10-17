import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { completeBankConnection } from '@/lib/gocardless';

/**
 * Hier komt de klant terug na het geven van toestemming bij zijn bank, met
 * ?ref=<ons kenmerk>. Alleen ingelogd, en alleen voor een koppeling van het
 * eigen bedrijf. Daarna terug naar Bank, met de uitkomst in de link.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.redirect('/login?callbackUrl=/app/bank');

  const tenantId = (session.user as any).tenantId;
  const reference = typeof req.query.ref === 'string' ? req.query.ref : '';

  try {
    const { imported } = await completeBankConnection(tenantId, reference);
    return res.redirect(`/app/bank?connected=1&imported=${imported}`);
  } catch (error: any) {
    console.error('Bank callback error:', error);
    return res.redirect(`/app/bank?connected=0&error=${encodeURIComponent(error.message || 'Koppelen mislukt')}`);
  }
}
