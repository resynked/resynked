import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';
import { appUrl } from './email';
import { fingerprint, saveStatement, type ParsedTransaction } from './bank';
import type { BankAccount } from './supabase';

/**
 * De bankkoppeling: transacties automatisch ophalen bij de bank van de klant,
 * via GoCardless Bank Account Data (PSD2). Optioneel, als plug-in; zonder
 * koppeling importeert de klant zelf een afschrift bij Bank.
 *
 * GoCardless heeft de vergunning om rekeninginformatie op te halen; Synbased
 * gebruikt hun API met één account voor het hele platform
 * (GOCARDLESS_SECRET_ID en GOCARDLESS_SECRET_KEY uit hun portaal). De klant
 * geeft bij zijn eigen bank toestemming, voor 90 dagen; daarna opnieuw.
 *
 * We praten rechtstreeks met de API (bankaccountdata.gocardless.com/api/v2).
 */

const API = 'https://bankaccountdata.gocardless.com/api/v2';

/** Zo lang geeft een bank toegang; langer staan Nederlandse banken niet toe */
const ACCESS_DAYS = 90;

/** Hoe ver we bij de eerste keer terug kijken, als de bank dat toestaat */
const HISTORY_DAYS = 365;

const DAY = 24 * 60 * 60 * 1000;

/** Of het platform de koppeling heeft ingesteld */
export function isBankLinkConfigured(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}

// Het toegangstoken is een dag geldig; we bewaren het zolang deze server draait
let cachedToken: { access: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.access;
  if (!isBankLinkConfigured()) throw new Error('De bankkoppeling is niet ingesteld (GOCARDLESS_SECRET_ID en GOCARDLESS_SECRET_KEY)');

  const response = await fetch(`${API}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ secret_id: process.env.GOCARDLESS_SECRET_ID, secret_key: process.env.GOCARDLESS_SECRET_KEY }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'De bankkoppeling kon niet inloggen bij GoCardless');

  cachedToken = { access: data.access, expiresAt: Date.now() + (Number(data.access_expires) || 3600) * 1000 };
  return data.access;
}

async function gcFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.summary || `GoCardless antwoordde met ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  return data;
}

export interface Institution {
  id: string;
  name: string;
  /** Hoeveel dagen terug deze bank transacties levert */
  days: number;
}

/** De Nederlandse banken die je kunt koppelen */
export async function listInstitutions(): Promise<Institution[]> {
  const list = await gcFetch('/institutions/?country=nl');
  return (list || [])
    .map((i: any) => ({ id: i.id, name: i.name, days: Number(i.transaction_total_days) || 90 }))
    .sort((a: Institution, b: Institution) => a.name.localeCompare(b.name));
}

/** De laatste koppeling van dit bedrijf, als die er is */
export async function getBankConnection(tenantId: string) {
  const { data } = await supabaseAdmin
    .from('bank_connections')
    .select('institution_name, status, expires_at, created_at')
    .eq('tenant_id', tenantId)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  // Over de 90 dagen: dan is de toestemming verlopen, ook als we het nog niet merkten
  const expired = data.status === 'expired' || (data.expires_at && new Date(data.expires_at).getTime() < Date.now());
  return { institution: data.institution_name || 'Je bank', status: expired ? 'expired' : data.status, expiresAt: data.expires_at };
}

/**
 * Begint een koppeling: een toestemming bij GoCardless voor deze bank, en
 * de link waar de klant naartoe gaat om bij zijn bank in te loggen. Daarna
 * komt hij terug op /api/bank/callback.
 */
export async function startBankConnection(tenantId: string, institutionId: string): Promise<string> {
  const institutions = await listInstitutions();
  const institution = institutions.find(i => i.id === institutionId);
  if (!institution) throw new Error('Deze bank kun je niet koppelen');

  const agreement = await gcFetch('/agreements/enduser/', {
    method: 'POST',
    body: JSON.stringify({
      institution_id: institution.id,
      max_historical_days: Math.min(HISTORY_DAYS, institution.days),
      access_valid_for_days: ACCESS_DAYS,
      access_scope: ['balances', 'details', 'transactions'],
    }),
  });

  const reference = randomUUID();
  const requisition = await gcFetch('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: `${appUrl()}/api/bank/callback`,
      institution_id: institution.id,
      agreement: agreement.id,
      reference,
      user_language: 'NL',
    }),
  });

  const { error } = await supabaseAdmin.from('bank_connections').insert({
    tenant_id: tenantId,
    requisition_id: requisition.id,
    reference,
    institution_id: institution.id,
    institution_name: institution.name,
    status: 'pending',
    expires_at: new Date(Date.now() + ACCESS_DAYS * DAY).toISOString(),
  });
  if (error) throw error;

  return requisition.link;
}

/**
 * De klant is terug van zijn bank. Is de toestemming gegeven, dan komen zijn
 * rekeningen in Synbased en halen we meteen de transacties op.
 */
export async function completeBankConnection(tenantId: string, reference: string) {
  const { data: connection } = await supabaseAdmin
    .from('bank_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference', reference)
    .maybeSingle();
  if (!connection) throw new Error('Deze koppeling hoort niet bij jouw account');

  const requisition = await gcFetch(`/requisitions/${connection.requisition_id}/`);
  if (requisition.status !== 'LN' || !(requisition.accounts || []).length) {
    throw new Error('De bank heeft geen toestemming gegeven. Probeer het opnieuw.');
  }

  for (const accountId of requisition.accounts as string[]) {
    const details = await gcFetch(`/accounts/${accountId}/details/`);
    const iban = String(details.account?.iban || '').replace(/\s/g, '');
    if (!iban) continue;

    const { data: existing } = await supabaseAdmin
      .from('bank_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('iban', iban)
      .maybeSingle();

    const values = { external_id: accountId, name: details.account?.name || details.account?.product || null };
    if (existing) {
      await supabaseAdmin.from('bank_accounts').update(values).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('bank_accounts').insert({ tenant_id: tenantId, iban, ...values });
    }
  }

  // Een eerdere koppeling met dezelfde bank is hiermee vervangen
  await supabaseAdmin.from('bank_connections').update({ status: 'expired' }).eq('tenant_id', tenantId).eq('status', 'linked');
  await supabaseAdmin.from('bank_connections').update({ status: 'linked' }).eq('id', connection.id);

  return syncBankAccounts(tenantId);
}

/** Een transactie van GoCardless in dezelfde vorm als uit een afschrift */
function toTransaction(t: any): ParsedTransaction | null {
  const booked_on = String(t.bookingDate || t.valueDate || '').slice(0, 10);
  const amount = Math.round(Number(t.transactionAmount?.amount) * 100) / 100;
  if (!booked_on || !amount) return null;

  const incoming = amount > 0;
  const counterparty_name = (incoming ? t.debtorName : t.creditorName) || '';
  const counterparty_iban = String((incoming ? t.debtorAccount?.iban : t.creditorAccount?.iban) || '').replace(/\s/g, '');
  const description = String(
    t.remittanceInformationUnstructured ||
      (t.remittanceInformationUnstructuredArray || []).join(' ') ||
      t.remittanceInformationStructured ||
      t.additionalInformation ||
      ''
  ).replace(/\s+/g, ' ').trim();

  const bankId = t.transactionId || t.internalTransactionId;
  return {
    booked_on,
    amount,
    counterparty_name,
    counterparty_iban,
    description,
    external_id: bankId ? `g:${bankId}` : fingerprint([booked_on, amount, counterparty_iban, description]),
  };
}

/**
 * Haalt de nieuwe transacties op van elke gekoppelde rekening en bewaart ze
 * zoals een afschrift, met het automatisch koppelen erbij. De eerste keer
 * rekenen we het beginsaldo terug uit het huidige saldo.
 *
 * Banken staan maar een paar keer per dag ophalen toe; daarom één keer per
 * ochtend (cron) en verder alleen als de klant erom vraagt.
 */
export async function syncBankAccounts(tenantId: string) {
  const { data: accounts } = await supabaseAdmin
    .from('bank_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('external_id', 'is', null);

  let imported = 0;
  let matched = 0;

  for (const account of (accounts || []) as BankAccount[]) {
    try {
      // Een paar dagen overlap: transacties die laat geboekt worden, komen er zo toch bij
      const since = account.last_synced_at
        ? new Date(new Date(account.last_synced_at).getTime() - 5 * DAY)
        : new Date(Date.now() - HISTORY_DAYS * DAY);
      const dateFrom = since.toISOString().slice(0, 10);

      const data = await gcFetch(`/accounts/${account.external_id}/transactions/?date_from=${dateFrom}`);
      const transactions = ((data.transactions?.booked || []) as any[])
        .map(toTransaction)
        .filter((t): t is ParsedTransaction => !!t);

      // Het beginsaldo: het saldo nu, min alles wat we nu binnenhalen
      let opening_balance: number | null = null;
      let opening_date: string | null = null;
      if (account.opening_balance === null) {
        const balances = await gcFetch(`/accounts/${account.external_id}/balances/`);
        const current = (balances.balances || []).find((b: any) => /closingBooked|interimBooked|expected/.test(b.balanceType));
        if (current) {
          const movement = transactions.reduce((sum, t) => sum + t.amount, 0);
          opening_balance = Math.round((Number(current.balanceAmount?.amount) - movement) * 100) / 100;
          opening_date = transactions.length ? transactions.map(t => t.booked_on).sort()[0] : dateFrom;
        }
      }

      const result = await saveStatement(tenantId, { iban: account.iban, opening_balance, opening_date, transactions }, account);
      imported += result.imported;
      matched += result.matched;

      await supabaseAdmin.from('bank_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', account.id);
    } catch (error: any) {
      // Verlopen toestemming: de klant moet opnieuw koppelen
      if (error.status === 401 || error.status === 403) {
        await supabaseAdmin.from('bank_connections').update({ status: 'expired' }).eq('tenant_id', tenantId).eq('status', 'linked');
      }
      throw error;
    }
  }

  return { imported, matched };
}

/** De koppeling verwijderen; de transacties die er al zijn blijven staan */
export async function deleteBankConnection(tenantId: string) {
  const { data: connections } = await supabaseAdmin
    .from('bank_connections')
    .select('id, requisition_id')
    .eq('tenant_id', tenantId);

  for (const connection of connections || []) {
    // Ook bij GoCardless intrekken; lukt dat niet, dan verloopt hij vanzelf
    await gcFetch(`/requisitions/${connection.requisition_id}/`, { method: 'DELETE' }).catch(() => {});
  }

  await supabaseAdmin.from('bank_connections').delete().eq('tenant_id', tenantId);
  await supabaseAdmin.from('bank_accounts').update({ external_id: null }).eq('tenant_id', tenantId);
}

/** Alle bedrijven met een werkende koppeling, voor het ophalen in de ochtend */
export async function linkedTenants(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('bank_connections').select('tenant_id').eq('status', 'linked');
  return [...new Set((data || []).map(row => row.tenant_id as string))];
}
