import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getQuote, getTenant, updateQuote } from '@/lib/db';
import { buildQuoteEmailHtml, buildQuoteEmailSubject, quoteLink } from '@/lib/email';
import { MailAuthError, getMailAccount, openMailbox } from '@/lib/mail';

/**
 * Een offerte naar de klant mailen: dezelfde mail met logo, eigen tekst en
 * de knop om te bekijken en te ondertekenen.
 *
 * De mail gaat via de Gmail of Outlook die de gebruiker bij Plug-ins heeft
 * gekoppeld: vanaf zijn eigen adres, en hij staat ook in zijn Verzonden. Een
 * antwoord van de klant komt gewoon in zijn Inbox. Zonder koppeling kan er
 * niet verstuurd worden; het scherm laat de knop dan ook niet zien.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const userId = (session.user as any).id;
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    const quote = await getQuote(id, tenantId);
    const tenant = await getTenant(tenantId);
    const customer = quote.customer;

    if (!customer?.email) {
      return res
        .status(400)
        .json({ error: 'Deze klant heeft geen e-mailadres. Vul dat eerst in bij de klantgegevens.' });
    }

    if (!quote.public_token) {
      return res.status(500).json({ error: 'Deze offerte heeft geen sleutel. Draai MIGRATION.sql in de Supabase SQL-editor.' });
    }

    const subject = buildQuoteEmailSubject(tenant, quote, customer);
    const html = buildQuoteEmailHtml({ tenant, customer, quote, token: quote.public_token });

    const mailAccount = await getMailAccount(userId);
    if (!mailAccount) {
      return res.status(400).json({
        error: 'Koppel eerst je Gmail of Outlook bij Instellingen > Plug-ins; offertes gaan vanuit je eigen mailbox.',
      });
    }

    try {
      const mailbox = await openMailbox(userId);
      await mailbox.provider.compose(mailbox.accessToken, [customer.email], subject, html, mailbox.email);
    } catch (error) {
      if (error instanceof MailAuthError) {
        return res.status(409).json({
          error: 'De koppeling met je mailbox is verlopen. Zet hem bij Instellingen > Plug-ins opnieuw aan en verstuur de offerte nog eens.',
        });
      }
      throw error;
    }
    const via = mailAccount.provider;

    // Een offerte die al goedgekeurd of afgewezen is blijft staan waar hij staat
    const status = quote.status === 'draft' ? 'sent' : quote.status;

    await updateQuote(id, tenantId, { status, sent_at: new Date().toISOString() } as any);

    return res.status(200).json({
      success: true,
      sentTo: customer.email,
      via,
      link: quoteLink(quote.public_token),
    });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
