import { randomBytes } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { STATE_COOKIE, isMailProvider, mailProvider, redirectUri } from '@/lib/mail';

/**
 * Begint het koppelen: stuurt door naar het inlogscherm van Google of
 * Microsoft. Dit draait in het popupvenster dat Instellingen opent.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { provider } = req.query;
  if (!isMailProvider(provider)) return res.status(404).json({ error: 'Onbekende mailaanbieder' });

  try {
    const state = randomBytes(24).toString('base64url');
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

    // Tien minuten om in te loggen, en alleen terug te lezen door onze eigen terugkeer
    res.setHeader(
      'Set-Cookie',
      `${STATE_COOKIE}=${state}; Path=/api/mail/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure}`
    );
    res.redirect(mailProvider(provider).authorizeUrl(redirectUri(provider), state));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Koppelen kon niet beginnen' });
  }
}
