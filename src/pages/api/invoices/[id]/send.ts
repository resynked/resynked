import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { assignInvoiceNumber, getInvoice, getTenant, updateInvoice } from '@/lib/db';
import { buildCreditNoteEmailHtml, buildInvoiceEmailHtml, buildInvoiceEmailSubject } from '@/lib/email';
import { isCreditNote } from '@/lib/invoices';
import { MailAuthError, getMailAccount, openMailbox } from '@/lib/mail';

/**
 * Een factuur naar de klant mailen: logo, eigen tekst, de betaalgegevens met
 * QR-code, en een knop naar de pagina waar hij de factuur bekijkt en betaalt.
 *
 * Net als bij offertes via de Gmail of Outlook die de gebruiker bij Plug-ins
 * heeft gekoppeld: vanaf zijn eigen adres, en hij staat in zijn Verzonden.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;
  const userId = (session.user as any).id;
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

  try {
    const invoice = await getInvoice(id, tenantId);
    const tenant = await getTenant(tenantId);
    const customer = invoice.customer;

    if (!customer?.email) {
      return res.status(400).json({ error: 'Deze klant heeft geen e-mailadres. Vul dat eerst in bij de klantgegevens.' });
    }
    if (!invoice.public_token) {
      return res.status(500).json({ error: 'Deze factuur heeft geen sleutel. Draai MIGRATION.sql in de Supabase SQL-editor.' });
    }
    if (!(await getMailAccount(userId))) {
      return res.status(400).json({
        error: 'Koppel eerst je Gmail of Outlook bij Instellingen > Plug-ins; facturen gaan vanuit je eigen mailbox.',
      });
    }

    // Het nummer moet in de mail staan, dus het komt nu al; mislukt de mail,
    // dan houdt het concept dit nummer voor de volgende poging
    invoice.invoice_number = await assignInvoiceNumber(id, tenantId);

    // Een creditfactuur heeft een eigen mail, zonder betaalgegevens
    const subject = isCreditNote(invoice)
      ? `Creditfactuur ${invoice.invoice_number || ''}`.trim()
      : buildInvoiceEmailSubject(tenant, invoice, customer);
    const html = isCreditNote(invoice)
      ? buildCreditNoteEmailHtml({ tenant, customer, invoice, originalNumber: invoice.credit_for?.invoice_number })
      : buildInvoiceEmailHtml({ tenant, customer, invoice });

    try {
      const mailbox = await openMailbox(userId);
      await mailbox.provider.compose(mailbox.accessToken, [customer.email], subject, html, mailbox.email);
    } catch (error) {
      if (error instanceof MailAuthError) {
        return res.status(409).json({
          error: 'De koppeling met je mailbox is verlopen. Zet hem bij Instellingen > Plug-ins opnieuw aan en verstuur de factuur nog eens.',
        });
      }
      throw error;
    }

    // Een betaalde of geannuleerde factuur blijft staan waar hij staat
    const status = invoice.status === 'draft' ? 'sent' : invoice.status;
    await updateInvoice(id, tenantId, { status, sent_at: new Date().toISOString(), sent_by: userId });

    return res.status(200).json({ ok: true, to: customer.email });
  } catch (error: any) {
    console.error('Send invoice error:', error);
    return res.status(500).json({ error: error.message || 'De factuur kon niet worden verstuurd' });
  }
}
