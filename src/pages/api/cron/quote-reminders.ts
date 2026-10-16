import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenant } from '@/lib/db';
import { buildQuoteEmailSubject, buildQuoteReminderEmailHtml } from '@/lib/email';
import { openMailbox } from '@/lib/mail';
import type { Tenant } from '@/lib/supabase';

/** Niet meer dan dit per keer, zodat de functie binnen zijn tijd blijft */
const BATCH = 50;

/**
 * Elke ochtend, aangeroepen door Vercel Cron (zie vercel.json): een
 * herinnering voor elke verstuurde offerte die na het ingestelde aantal dagen
 * nog niet is ondertekend. Eén herinnering per offerte, vanuit de mailbox van
 * wie hem verstuurde, met dezelfde knop als de offertemail.
 *
 * Alleen Vercel mag dit aanroepen: die stuurt CRON_SECRET mee.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: quotes, error } = await supabaseAdmin
    .from('quotes')
    .select('id, tenant_id, quote_number, valid_until, public_token, sent_at, sent_by, customer:customers(*)')
    .eq('status', 'sent')
    .is('signed_at', null)
    .is('reminder_sent_at', null)
    .not('sent_at', 'is', null)
    .not('sent_by', 'is', null)
    // Een verlopen offerte krijgt geen herinnering meer
    .gte('valid_until', today)
    .order('sent_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('Quote reminders query error:', error);
    return res.status(500).json({ error: 'Query failed' });
  }

  const tenants = new Map<string, Tenant | null>();
  let sent = 0;
  let failed = 0;

  for (const quote of (quotes || []) as any[]) {
    if (sent >= BATCH) break;

    if (!tenants.has(quote.tenant_id)) {
      tenants.set(quote.tenant_id, await getTenant(quote.tenant_id).catch(() => null));
    }
    const tenant = tenants.get(quote.tenant_id);
    const days = tenant?.quote_reminder_days;
    if (!tenant || !days) continue;

    // Nog niet lang genoeg geleden verstuurd
    if (Date.now() - new Date(quote.sent_at).getTime() < days * 24 * 60 * 60 * 1000) continue;
    if (!quote.customer?.email) continue;

    try {
      const mailbox = await openMailbox(quote.sent_by);
      const subject = `Herinnering: ${buildQuoteEmailSubject(tenant, quote, quote.customer)}`;
      const html = buildQuoteReminderEmailHtml({ tenant, customer: quote.customer, quote, token: quote.public_token });
      await mailbox.provider.compose(mailbox.accessToken, [quote.customer.email], subject, html, mailbox.email);

      await supabaseAdmin.from('quotes').update({ reminder_sent_at: new Date().toISOString() }).eq('id', quote.id);
      sent++;
    } catch (error) {
      // Geen mailbox meer gekoppeld, of verlopen: morgen gewoon opnieuw proberen
      console.error(`Quote reminder for ${quote.id} failed:`, error);
      failed++;
    }
  }

  return res.status(200).json({ sent, failed });
}
