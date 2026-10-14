import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { openMailbox, parseEventInput, sendMailError } from '@/lib/mail';

/** Hoeveel dagen er in één keer opgehaald mogen worden. */
const MAX_DAYS = 62;

/**
 * De afspraken uit de gekoppelde agenda van Google of Outlook. GET tussen
 * ?from= en ?to= (ISO-tijden); POST maakt een nieuwe afspraak aan, rechtstreeks
 * in die agenda. Er wordt niets bij ons bewaard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const parsed = parseEventInput(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    try {
      const { provider, accessToken } = await openMailbox((session.user as any).id);
      await provider.createEvent(accessToken, parsed.event);
      return res.status(200).json({ ok: true });
    } catch (error) {
      return sendMailError(res, error);
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
