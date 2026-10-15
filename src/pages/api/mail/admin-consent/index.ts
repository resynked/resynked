import { NextApiRequest, NextApiResponse } from 'next';
import { appUrl } from '@/lib/email';

/**
 * De link die een gebruiker naar zijn IT-beheerder stuurt. De beheerder heeft
 * zelf geen account bij Khance; deze route stuurt alleen door naar Microsoft,
 * waar hij met één klik toestemming geeft voor de hele organisatie.
 *
 * .default vraagt precies de rechten die in de app-registratie staan.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) return res.status(500).send('Microsoft is nog niet ingesteld');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'https://graph.microsoft.com/.default',
    redirect_uri: `${appUrl()}/api/mail/admin-consent/done`,
  });

  res.redirect(`https://login.microsoftonline.com/organizations/v2.0/adminconsent?${params}`);
}
