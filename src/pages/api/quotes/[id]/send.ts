import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getQuote, getTenant, updateQuote } from '@/lib/db';
import { buildQuoteEmailHtml, buildQuoteEmailSubject, buildSender, quoteLink, sendMail } from '@/lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
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

    await sendMail({
      to: customer.email,
      subject: buildQuoteEmailSubject(tenant, quote),
      html: buildQuoteEmailHtml({ tenant, customer, quote, token: quote.public_token }),
      // Het adres uit Instellingen > E-mail; is dat leeg, dan het systeemadres
      from: buildSender(tenant),
      // Antwoordt de klant op de mail, dan komt dat bij de aannemer terecht,
      // ook als de mail vanaf het systeemadres verstuurd is
      replyTo: tenant.email_from || tenant.email || undefined,
    });

    // Een offerte die al goedgekeurd of afgewezen is blijft staan waar hij staat
    const status = quote.status === 'draft' ? 'sent' : quote.status;

    await updateQuote(id, tenantId, { status, sent_at: new Date().toISOString() } as any);

    return res.status(200).json({
      success: true,
      sentTo: customer.email,
      link: quoteLink(quote.public_token),
    });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
