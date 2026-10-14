import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { INBOX_FOLDER, openMailbox, sendMailError } from '@/lib/mail';

/**
 * De inbox, een pagina tegelijk. Wordt rechtstreeks bij Gmail of Outlook
 * opgehaald; er wordt niets van de mail bij ons bewaard.
 *
 * ?folder=... welke map (standaard de inbox), ?q=... zoeken in alle mail,
 * ?unread=1 alleen ongelezen, ?page=... de volgende pagina.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);
    const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

    const page = await provider.list(accessToken, {
      folder: text(req.query.folder) || INBOX_FOLDER,
      search: text(req.query.q),
      unreadOnly: req.query.unread === '1',
      pageToken: typeof req.query.page === 'string' && req.query.page ? req.query.page : undefined,
    });

    return res.status(200).json(page);
  } catch (error) {
    return sendMailError(res, error);
  }
}
