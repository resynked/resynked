import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { updateInvoice } from '@/lib/db';
import { getMolliePayment } from '@/lib/mollie';

/**
 * Mollie meldt hier dat er iets met een betaling is gebeurd. Er komt alleen
 * een id mee; de stand vragen we zelf op bij Mollie, met de sleutel van het
 * bedrijf. Zo kan niemand met een nagemaakt bericht een factuur op betaald zetten.
 *
 * Altijd 200 terug, ook als we er niets mee doen: anders blijft Mollie het
 * bericht opnieuw sturen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const paymentId = typeof req.body?.id === 'string' ? req.body.id : '';
  if (!paymentId) return res.status(200).end();

  try {
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, tenant_id, status')
      .eq('mollie_payment_id', paymentId)
      .maybeSingle();
    if (!invoice) return res.status(200).end();

    const payment = await getMolliePayment(invoice.tenant_id, paymentId);

    if (payment.status === 'paid' && invoice.status !== 'paid') {
      await updateInvoice(invoice.id, invoice.tenant_id, {
        status: 'paid',
        paid_at: payment.paidAt || new Date().toISOString(),
      });
    }

    return res.status(200).end();
  } catch (error) {
    console.error('Mollie webhook error:', error);
    // Een 500 laat Mollie het later nog eens proberen
    return res.status(500).end();
  }
}
