import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { openMailbox, parseEventInput, sendMailError } from '@/lib/mail';

/** Eén afspraak wijzigen (PATCH) of verwijderen (DELETE), in Google of Outlook zelf. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'Invalid ID' });

  try {
    if (req.method === 'PATCH') {
      const parsed = parseEventInput(req.body);
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });

      const { provider, accessToken } = await openMailbox((session.user as any).id);
      await provider.updateEvent(accessToken, id, parsed.event);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { provider, accessToken } = await openMailbox((session.user as any).id);
      await provider.deleteEvent(accessToken, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendMailError(res, error);
  }
}
