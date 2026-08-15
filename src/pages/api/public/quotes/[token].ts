import { NextApiRequest, NextApiResponse } from 'next';
import { getQuoteByToken } from '@/lib/db';

/**
 * De offerte zoals de klant hem te zien krijgt. Hier is geen sessie: de sleutel
 * uit de mail is het enige bewijs, dus er gaat niet meer terug dan de pagina
 * nodig heeft en er wordt niets op een id opgezocht.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (typeof token !== 'string') {
    return res.status(400).json({ error: 'Ongeldige link' });
  }

  try {
    const result = await getQuoteByToken(token);

    if (!result) {
      return res.status(404).json({ error: 'Deze offerte bestaat niet of de link is verlopen' });
    }

    const { quote, tenant } = result;

    // Zoekmachines en tussenliggende servers mogen dit niet bewaren
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    return res.status(200).json({
      quote,
      // Alleen wat het document nodig heeft om er goed uit te zien
      tenant: {
        company_name: tenant.company_name,
        street_address: tenant.street_address,
        postal_code: tenant.postal_code,
        city: tenant.city,
        email: tenant.email,
        phone: tenant.phone,
        kvk: tenant.kvk,
        btw_number: tenant.btw_number,
        iban: tenant.iban,
        logo_url: tenant.logo_url,
        quote_conditions: tenant.quote_conditions,
        terms_and_conditions: tenant.terms_and_conditions,
        quote_template_html: tenant.quote_template_html,
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
