import { NextApiRequest, NextApiResponse } from 'next';
import { getInvoiceByToken } from '@/lib/db';
import { getMollieAccount } from '@/lib/mollie';

/**
 * De factuur zoals de klant hem te zien krijgt. Geen sessie: de sleutel uit de
 * mail is het enige bewijs, dus er gaat niet meer terug dan de pagina nodig
 * heeft. Plus of er met Mollie betaald kan worden.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Ongeldige link' });

  try {
    const result = await getInvoiceByToken(token);
    if (!result) return res.status(404).json({ error: 'Deze factuur bestaat niet of de link is verlopen' });

    const { invoice, tenant } = result;
    const { tenant_id, ...publicInvoice } = invoice;

    // Zoekmachines en tussenliggende servers mogen dit niet bewaren
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    return res.status(200).json({
      invoice: publicInvoice,
      // Een concept of geannuleerde factuur valt niet te betalen
      canPayOnline:
        // Niet bij een creditfactuur: die heeft een min-bedrag
        !!(await getMollieAccount(tenant_id).catch(() => null)) && invoice.status === 'sent' && Number(invoice.total) > 0,
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
        terms_and_conditions: tenant.terms_and_conditions,
        invoice_template_html: tenant.invoice_template_html,
        paper_orientation: tenant.paper_orientation,
      },
    });
  } catch (error) {
    console.error('Public invoice error:', error);
    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
