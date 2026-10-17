import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenant } from '@/lib/db';
import { buildInvoiceReminderEmailHtml, buildInvoiceReminderEmailSubject } from '@/lib/email';
import { openMailbox } from '@/lib/mail';
import type { Tenant } from '@/lib/supabase';

/** Niet meer dan dit per keer, zodat de functie binnen zijn tijd blijft */
const BATCH = 50;

/** Na de tweede herinnering stopt het; daarna is het aan de aannemer zelf */
const MAX_REMINDERS = 2;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Elke ochtend, aangeroepen door Vercel Cron (zie vercel.json): een
 * betalingsherinnering voor elke verstuurde factuur die het ingestelde aantal
 * dagen over de vervaldatum is, en na nog eens zoveel dagen een tweede. Vanuit
 * de mailbox van wie de factuur verstuurde, met de betaalgegevens erin.
 *
 * Een creditfactuur heeft geen vervaldatum en valt er dus vanzelf buiten.
 *
 * Alleen Vercel mag dit aanroepen: die stuurt CRON_SECRET mee.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: invoices, error } = await supabaseAdmin
    .from('invoices')
    .select('id, tenant_id, invoice_number, total, due_date, public_token, sent_by, reminder_count, reminder_sent_at, customer:customers(*)')
    .eq('status', 'sent')
    .lt('reminder_count', MAX_REMINDERS)
    .lt('due_date', today)
    .gt('total', 0)
    .not('sent_by', 'is', null)
    .order('due_date', { ascending: true })
    .limit(500);

  if (error) {
    console.error('Invoice reminders query error:', error);
    return res.status(500).json({ error: 'Query failed' });
  }

  const tenants = new Map<string, Tenant | null>();
  let sent = 0;
  let failed = 0;

  for (const invoice of (invoices || []) as any[]) {
    if (sent >= BATCH) break;

    if (!tenants.has(invoice.tenant_id)) {
      tenants.set(invoice.tenant_id, await getTenant(invoice.tenant_id).catch(() => null));
    }
    const tenant = tenants.get(invoice.tenant_id);
    const days = tenant?.invoice_reminder_days;
    if (!tenant || !days) continue;

    // De eerste telt vanaf de vervaldatum, de tweede vanaf de eerste
    const from = invoice.reminder_sent_at ? new Date(invoice.reminder_sent_at) : new Date(`${invoice.due_date}T00:00:00`);
    if (Date.now() - from.getTime() < days * DAY) continue;
    if (!invoice.customer?.email) continue;

    const count = (invoice.reminder_count || 0) + 1;

    try {
      const mailbox = await openMailbox(invoice.sent_by);
      const subject = buildInvoiceReminderEmailSubject(tenant, invoice, invoice.customer, count);
      const html = buildInvoiceReminderEmailHtml({ tenant, customer: invoice.customer, invoice, count });
      await mailbox.provider.compose(mailbox.accessToken, [invoice.customer.email], subject, html, mailbox.email);

      await supabaseAdmin
        .from('invoices')
        .update({ reminder_count: count, reminder_sent_at: new Date().toISOString() })
        .eq('id', invoice.id);
      sent++;
    } catch (error) {
      // Geen mailbox meer gekoppeld, of verlopen: morgen gewoon opnieuw proberen
      console.error(`Invoice reminder for ${invoice.id} failed:`, error);
      failed++;
    }
  }

  return res.status(200).json({ sent, failed });
}
