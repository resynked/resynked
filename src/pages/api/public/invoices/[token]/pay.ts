import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getInvoiceByToken } from '@/lib/db';
import { appUrl, invoiceLink } from '@/lib/email';
import { createMolliePayment } from '@/lib/mollie';
import { invoiceReference } from '@/lib/payment';

/**
 * Betalen met Mollie vanaf de factuurpagina: maakt een betaling aan en geeft
 * het adres terug waar de klant betaalt. Daarna komt hij terug op zijn factuur;
 * of het gelukt is, meldt Mollie los aan de webhook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Ongeldige link' });

  try {
    const result = await getInvoiceByToken(token);
    if (!result) return res.status(404).json({ error: 'Deze factuur bestaat niet' });

    const { invoice } = result;
    // Een creditfactuur heeft een min-bedrag: daar valt niets te betalen
    if (invoice.status !== 'sent' || Number(invoice.total) <= 0) {
      return res.status(400).json({ error: invoice.status === 'paid' ? 'Deze factuur is al betaald' : 'Deze factuur kan niet betaald worden' });
    }

    const payment = await createMolliePayment(invoice.tenant_id, {
      amount: Number(invoice.total) || 0,
      description: invoiceReference(invoice),
      redirectUrl: `${invoiceLink(token)}?paid=1`,
      webhookUrl: `${appUrl()}/api/webhooks/mollie`,
      invoiceId: invoice.id,
    });

    await supabaseAdmin.from('invoices').update({ mollie_payment_id: payment.id }).eq('id', invoice.id);

    return res.status(200).json({ checkoutUrl: payment.checkoutUrl });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ error: 'Betalen lukt nu niet. Probeer het later opnieuw of maak het bedrag over.' });
  }
}
