import { NextApiRequest, NextApiResponse } from 'next';
import QRCode from 'qrcode';
import { getInvoiceByToken } from '@/lib/db';
import { canRequestPayment, epcPayload, invoiceReference } from '@/lib/payment';

/**
 * De betaal-QR-code als PNG, voor in de factuurmail. Mailprogramma's tonen een
 * gewone afbeelding van een adres, maar geen data-URL of SVG.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).end();

  try {
    const result = await getInvoiceByToken(token);
    if (!result) return res.status(404).end();

    const { invoice, tenant } = result;
    const payment = {
      name: tenant.company_name || tenant.name || '',
      iban: tenant.iban || '',
      amount: Number(invoice.total) || 0,
      reference: invoiceReference(invoice),
    };
    if (!canRequestPayment(payment)) return res.status(404).end();

    const png = await QRCode.toBuffer(epcPayload(payment), { margin: 1, width: 360, errorCorrectionLevel: 'M' });

    res.setHeader('Content-Type', 'image/png');
    // Het bedrag kan nog veranderen zolang de factuur niet betaald is
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(png);
  } catch (error) {
    console.error('Invoice QR error:', error);
    return res.status(500).end();
  }
}
