import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getInvoice } from '@/lib/db';
import { renderPdf, requestOrigin } from '@/lib/pdf';
import { invoiceTitle } from '@/lib/invoices';

// Een browser starten en een document opmaken duurt langer dan de standaardgrens
export const config = {
  maxDuration: 60,
};

/** De factuur als PDF, gemaakt van de afdrukpagina. Zelfde werkwijze als bij offertes. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    // Ophalen om te controleren dat de factuur van deze aannemer is, en om
    // het nummer te kennen voor de bestandsnaam
    const invoice = await getInvoice(id, tenantId);

    const pdf = await renderPdf({
      // ?pdf=1 zorgt dat die pagina niet zelf het printvenster opent
      // Op het adres van de gebruiker zelf, waar zijn sessie bij hoort
      url: `${requestOrigin(req)}/invoices/${id}/print?pdf=1`,
      cookie: req.headers.cookie,
    });

    const naam = `${invoiceTitle(invoice)} ${invoice.invoice_number || 'concept'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${naam.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('PDF maken mislukt:', error);
    return res.status(500).json({ error: error.message || 'De PDF kon niet gemaakt worden' });
  }
}
