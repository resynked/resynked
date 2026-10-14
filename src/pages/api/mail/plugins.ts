import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { appUrl } from '@/lib/email';

/**
 * Wat het koppelvenster nodig heeft om goedkeuring uit te leggen: de
 * Client-ID die een Google Workspace-beheerder invult, en de link voor een
 * Microsoft-beheerder. Beide zijn openbaar; ze staan ook gewoon in de
 * inloglink zelf.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    microsoftAdminConsentUrl: process.env.MICROSOFT_CLIENT_ID ? `${appUrl()}/api/mail/admin-consent` : null,
  });
}
