import { supabaseAdmin } from './supabase';
import { decrypt, encrypt } from './crypto';
import { appUrl } from './email';
import { getInvoice } from './db';
import { calculateElementTotals, getCustomerDisplayName } from './utils';

/**
 * Moneybird: elke vastgelegde factuur gaat vanzelf naar de boekhouding.
 * Optioneel, als plug-in; zonder Moneybird exporteert de aannemer het
 * btw-overzicht voor zijn boekhouder.
 *
 * Eén administratie per bedrijf, met een API-token uit het eigen
 * Moneybird-account. Een factuur komt daar als externe verkoopfactuur: de
 * factuur zelf blijft in Synbased, Moneybird boekt hem met de juiste btw. Is
 * hij betaald, dan krijgt hij daar ook een betaling.
 *
 * We praten rechtstreeks met de API van Moneybird (moneybird.com/api/v2). Ids
 * zijn daar lange getallen die als tekst binnenkomen; die blijven tekst.
 */

const API = 'https://moneybird.com/api/v2';

/** Een token dat niet klopt; de melding is voor de gebruiker */
export class MoneybirdTokenError extends Error {}

interface MoneybirdAccount {
  token: string;
  administrationId: string;
}

export interface MoneybirdAdministration {
  id: string;
  name: string;
}

async function moneybirdFetch(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new MoneybirdTokenError('Moneybird herkent dit token niet');
  if (!response.ok) {
    const detail = typeof data.error === 'string' ? data.error : data.error && JSON.stringify(data.error);
    const error = new Error(detail || `Moneybird antwoordde met ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  return data;
}

/** De administraties die bij dit token horen; tegelijk de controle of het token werkt */
export async function getMoneybirdAdministrations(token: string): Promise<MoneybirdAdministration[]> {
  if (!token.trim()) throw new MoneybirdTokenError('Vul je API-token in');
  const administrations = await moneybirdFetch(token.trim(), '/administrations.json');
  return (administrations || []).map((a: any) => ({ id: String(a.id), name: a.name }));
}

/** Of dit bedrijf Moneybird heeft gekoppeld, en met welke administratie */
export async function getMoneybirdAccount(tenantId: string): Promise<{ administration: string } | null> {
  const { data } = await supabaseAdmin
    .from('moneybird_accounts')
    .select('administration_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data) return null;
  return { administration: data.administration_name || 'Moneybird' };
}

export async function saveMoneybirdAccount(tenantId: string, token: string, administration: MoneybirdAdministration) {
  const { error } = await supabaseAdmin.from('moneybird_accounts').upsert(
    {
      tenant_id: tenantId,
      api_token: encrypt(token.trim()),
      administration_id: administration.id,
      administration_name: administration.name,
    },
    { onConflict: 'tenant_id' }
  );
  if (error) throw error;
}

export async function deleteMoneybirdAccount(tenantId: string) {
  const { error } = await supabaseAdmin.from('moneybird_accounts').delete().eq('tenant_id', tenantId);
  if (error) throw error;
}

async function accountOf(tenantId: string): Promise<MoneybirdAccount | null> {
  const { data } = await supabaseAdmin
    .from('moneybird_accounts')
    .select('api_token, administration_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data ? { token: decrypt(data.api_token), administrationId: data.administration_id } : null;
}

/** Een aanvraag binnen de administratie van het bedrijf */
function inAdministration(account: MoneybirdAccount, path: string, init?: RequestInit) {
  return moneybirdFetch(account.token, `/${account.administrationId}${path}`, init);
}

/**
 * Het contact in Moneybird bij deze klant. We herkennen hem aan een eigen
 * klantnummer (SB- plus het id), zodat dezelfde klant niet twee keer ontstaat;
 * bestaat hij nog niet, dan maken we hem aan met de gegevens uit Synbased.
 */
async function contactFor(account: MoneybirdAccount, customer: any): Promise<string> {
  const customerId = `SB-${customer.id}`;

  try {
    const existing = await inAdministration(account, `/contacts/customer_id/${encodeURIComponent(customerId)}.json`);
    if (existing?.id) return String(existing.id);
  } catch (error: any) {
    if (error.status !== 404) throw error;
  }

  const lastName = [customer.middle_name, customer.last_name].filter(Boolean).join(' ');
  const created = await inAdministration(account, '/contacts.json', {
    method: 'POST',
    body: JSON.stringify({
      contact: {
        customer_id: customerId,
        company_name: customer.company_name || (customer.first_name || lastName ? '' : getCustomerDisplayName(customer)),
        firstname: customer.first_name || '',
        lastname: lastName,
        address1: customer.street_address || '',
        zipcode: customer.postal_code || '',
        city: customer.city || '',
        email: customer.email || '',
        phone: customer.phone || '',
        chamber_of_commerce: customer.kvk || '',
        tax_number: customer.btw_number || '',
      },
    }),
  });
  return String(created.id);
}

/**
 * Het btw-tarief in Moneybird bij een percentage. Bij 0% gaat het gewone
 * nultarief voor, niet verlegd of buiten de EU.
 */
function taxRateFor(rates: any[], percentage: number): string {
  const matching = rates.filter(r => r.active !== false && Number(r.percentage) === percentage);
  const plain = matching.find(r => !/verlegd|buiten|reverse|export/i.test(r.name || '')) || matching[0];
  if (!plain) throw new Error(`Moneybird heeft geen btw-tarief van ${percentage}% voor verkoopfacturen`);
  return String(plain.id);
}

const amount = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

/**
 * Zet één factuur in Moneybird, als die plug-in aan staat. Een nieuwe
 * factuur komt erin als externe verkoopfactuur; is hij betaald, dan krijgt hij
 * daar ook de betaling. Al gedaan is al gedaan, dus twee keer aanroepen kan.
 *
 * Gooit een fout als het niet lukt; syncInvoiceToMoneybird vangt die op.
 */
export async function pushInvoiceToMoneybird(invoiceId: number | string, tenantId: string): Promise<boolean> {
  const account = await accountOf(tenantId);
  if (!account) return false;

  const invoice = await getInvoice(invoiceId, tenantId);
  if (invoice.status === 'draft' || invoice.status === 'cancelled') return false;

  let moneybirdId: string | null = invoice.moneybird_invoice_id || null;

  if (!moneybirdId) {
    const [contactId, rates] = await Promise.all([
      contactFor(account, invoice.customer),
      inAdministration(account, '/tax_rates.json?filter=tax_rate_type:sales_invoice'),
    ]);

    // Elke regel met het tarief van zijn prijstabel; korting als eigen min-regel
    const details: any[] = [];
    for (const block of invoice.blocks || []) {
      for (const element of block.elements || []) {
        if (element.kind !== 'prijstabel') continue;
        const taxRateId = taxRateFor(rates, Number(element.tax_percentage) || 0);

        for (const item of element.items || []) {
          if (item.is_heading) continue;
          details.push({
            description: item.description || 'Regel',
            amount: String(Number(item.quantity) || 0),
            price: amount(Number(item.price) || 0),
            tax_rate_id: taxRateId,
          });
        }

        const { discount } = calculateElementTotals(element);
        if (discount) {
          details.push({
            description: `Korting ${Number(element.discount_percentage)}%`,
            amount: '1',
            price: amount(-discount),
            tax_rate_id: taxRateId,
          });
        }
      }
    }
    if (details.length === 0) return false;

    const created = await inAdministration(account, '/external_sales_invoices.json', {
      method: 'POST',
      body: JSON.stringify({
        external_sales_invoice: {
          contact_id: contactId,
          reference: invoice.invoice_number,
          date: invoice.invoice_date,
          due_date: invoice.due_date || invoice.invoice_date,
          currency: invoice.currency || 'EUR',
          prices_are_incl_tax: false,
          source: 'Synbased',
          source_url: `${appUrl()}/invoices/${invoice.id}`,
          details_attributes: details,
        },
      }),
    });

    moneybirdId = String(created.id);
    await supabaseAdmin
      .from('invoices')
      .update({ moneybird_invoice_id: moneybirdId })
      .eq('id', invoice.id)
      .eq('tenant_id', tenantId);
  }

  // Betaald in Synbased, en in Moneybird nog niet: dan de betaling erbij
  if (invoice.status === 'paid') {
    const current = await inAdministration(account, `/external_sales_invoices/${moneybirdId}.json`);
    if (current?.state !== 'paid') {
      const paidOn = String(invoice.paid_at || new Date().toISOString()).slice(0, 10);
      await inAdministration(account, `/external_sales_invoices/${moneybirdId}/payments.json`, {
        method: 'POST',
        body: JSON.stringify({
          payment: { payment_date: paidOn, price: amount(Number(current?.total_unpaid ?? invoice.total)) },
        }),
      });
    }
  }

  return true;
}

/**
 * Hetzelfde als pushInvoiceToMoneybird, maar een fout houdt niets tegen: het
 * versturen of op betaald zetten in Synbased gaat altijd door. Wat niet lukte,
 * komt erin met "Facturen overzetten" bij de plug-in.
 */
export async function syncInvoiceToMoneybird(invoiceId: number | string, tenantId: string) {
  try {
    await pushInvoiceToMoneybird(invoiceId, tenantId);
  } catch (error) {
    console.error(`Moneybird sync for invoice ${invoiceId} failed:`, error);
  }
}

/**
 * Zet vastgelegde facturen die nog niet in Moneybird staan erin, een stuk per
 * keer zodat de functie binnen zijn tijd blijft. Geeft terug hoeveel het er
 * werden, hoeveel er nog over zijn, en de eerste fout als er een was.
 */
export async function pushOpenInvoicesToMoneybird(tenantId: string, batch = 20) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'paid'])
    .is('moneybird_invoice_id', null)
    .order('invoice_date', { ascending: true })
    .limit(batch + 1);
  if (error) throw error;

  const ids = (data || []).map(row => row.id);
  let pushed = 0;
  let failure: string | null = null;

  for (const id of ids.slice(0, batch)) {
    try {
      if (await pushInvoiceToMoneybird(id, tenantId)) pushed++;
    } catch (error: any) {
      // Eén factuur die niet past (bijvoorbeeld een onbekend tarief) houdt de rest niet tegen
      failure = failure || error.message;
      console.error(`Moneybird push for invoice ${id} failed:`, error);
    }
  }

  return { pushed, more: ids.length > batch && pushed > 0, error: failure };
}
