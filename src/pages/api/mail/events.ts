import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';

/** Hoeveel dagen er in één keer opgehaald mogen worden. */
const MAX_DAYS = 62;

/**
 * De afspraken uit de gekoppelde agenda van Google of Outlook, tussen
 * ?from= en ?to= (ISO-tijden). Alleen lezen; er wordt niets bewaard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const from = new Date(String(req.query.from || ''));
  const to = new Date(String(req.query.to || ''));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return res.status(400).json({ error: 'Ongeldige periode' });
  }
  if (to.getTime() - from.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Kies een kortere periode' });
  }

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);
    return res.status(200).json(await provider.events(accessToken, from, to));
  } catch (error) {
    return sendMailError(res, error);
  }
}
