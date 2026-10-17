import { createHash } from 'crypto';
import { supabaseAdmin } from './supabase';
import { updateInvoice } from './db';
import { BANK_CATEGORIES } from './constants';
import type { BankAccount, BankTransaction } from './supabase';

/**
 * De bank: afschriften inlezen, transacties bewaren en koppelen aan facturen,
 * kosten of een categorie.
 *
 * Een afschrift komt als CAMT.053 (XML) of MT940; die kan elke Nederlandse
 * bank leveren. Dezelfde transactie twee keer importeren kan geen kwaad: hij
 * wordt herkend aan het kenmerk van de bank, of anders aan zijn gegevens.
 */

const supabase = supabaseAdmin;

/** Eén transactie zoals hij uit een afschrift komt */
export interface ParsedTransaction {
  booked_on: string;
  amount: number;
  counterparty_name: string;
  counterparty_iban: string;
  description: string;
  external_id: string;
}

/** Eén rekening uit een afschrift, met het beginsaldo als dat erin staat */
export interface ParsedStatement {
  iban: string;
  opening_balance: number | null;
  opening_date: string | null;
  transactions: ParsedTransaction[];
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** Een kenmerk voor een transactie zonder kenmerk van de bank, uit zijn gegevens */
export function fingerprint(parts: (string | number)[]): string {
  return 'h:' + createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 24);
}

/** Geeft transacties met precies dezelfde gegevens een volgnummer, zodat ze allebei blijven */
function uniqueIds(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Map<string, number>();
  return transactions.map((transaction) => {
    const count = seen.get(transaction.external_id) || 0;
    seen.set(transaction.external_id, count + 1);
    return count ? { ...transaction, external_id: `${transaction.external_id}-${count}` } : transaction;
  });
}

// ---------- CAMT.053 ----------

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** De inhoud van het eerste element met deze naam, of leeg */
function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? match[1] : '';
}

/** De inhoud van alle elementen met deze naam */
function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map(m => m[1]);
}

function parseCamt(xml: string): ParsedStatement[] {
  // Voorvoegsels als <ns2:Ntry> weg, zodat elke bank er hetzelfde uitziet
  const clean = xml.replace(/<(\/?)[\w-]+:/g, '<$1');

  return tags(clean, 'Stmt').map((statement) => {
    const iban = decodeXml(tag(tag(statement, 'Acct'), 'IBAN')).replace(/\s/g, '');

    // Het beginsaldo van dit afschrift (OPBD), als het erin staat
    let opening_balance: number | null = null;
    let opening_date: string | null = null;
    for (const balance of tags(statement, 'Bal')) {
      if (!/<Cd>(OPBD|PRCD)<\/Cd>/.test(balance)) continue;
      const value = Number(decodeXml(tag(balance, 'Amt')));
      opening_balance = cents(tag(balance, 'CdtDbtInd').includes('DBIT') ? -value : value);
      // <Dt><Dt>2026-10-01</Dt></Dt> of <Dt><DtTm>…</DtTm></Dt>: de eerste datum die erin staat
      opening_date = /(\d{4}-\d{2}-\d{2})/.exec(balance.slice(balance.indexOf('<Dt')))?.[1] || null;
      break;
    }

    const transactions = tags(statement, 'Ntry').map((entry): ParsedTransaction => {
      const credit = tag(entry, 'CdtDbtInd').includes('CRDT');
      const value = Number(decodeXml(tag(entry, 'Amt')));
      const amount = cents(credit ? value : -value);
      const bookingDate = tag(entry, 'BookgDt');
      const booked_on = decodeXml(tag(bookingDate, 'Dt') || tag(bookingDate, 'DtTm')).slice(0, 10);

      // Bij geld dat binnenkomt is de betaler de tegenpartij, anders de ontvanger
      const details = tag(entry, 'TxDtls') || entry;
      const parties = tag(details, 'RltdPties');
      const party = tag(parties, credit ? 'Dbtr' : 'Cdtr');
      const counterparty_name = decodeXml(tag(party, 'Nm'));
      const counterparty_iban = decodeXml(tag(tag(parties, credit ? 'DbtrAcct' : 'CdtrAcct'), 'IBAN')).replace(/\s/g, '');

      const remittance = tag(details, 'RmtInf');
      const description = decodeXml(
        tags(remittance, 'Ustrd').join(' ') || tag(remittance, 'Ref') || tag(entry, 'AddtlNtryInf')
      ).replace(/\s+/g, ' ');

      const bankRef = decodeXml(tag(entry, 'AcctSvcrRef') || tag(entry, 'NtryRef'));
      return {
        booked_on,
        amount,
        counterparty_name,
        counterparty_iban,
        description,
        external_id: bankRef ? `r:${bankRef}` : fingerprint([booked_on, amount, counterparty_iban, description]),
      };
    });

    return { iban, opening_balance, opening_date, transactions: uniqueIds(transactions.filter(t => t.booked_on)) };
  });
}

// ---------- MT940 ----------

/** Een datum als jjmmdd naar jjjj-mm-dd */
function mtDate(value: string): string {
  return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

const mtAmount = (value: string) => Number(value.replace(',', '.'));

/** Naam, IBAN en omschrijving uit het :86:-veld; elke bank doet het net anders */
function parseMt86(text: string) {
  const flat = text.replace(/\r?\n/g, '');
  const field = (code: string) => (new RegExp(`/${code}/([^/]*)`).exec(flat)?.[1] || '').trim();

  // Gestructureerd zoals ING en Rabobank: /NAME/.../IBAN/.../REMI/...
  if (/\/(NAME|IBAN|REMI|CNTP)\//.test(flat)) {
    const cntp = /\/CNTP\/([^/]*)\/([^/]*)\/([^/]*)\//.exec(flat);
    return {
      counterparty_name: field('NAME') || cntp?.[3]?.trim() || '',
      counterparty_iban: (field('IBAN') || cntp?.[1] || '').replace(/\s/g, ''),
      description: (field('REMI') || field('USTD') || flat).replace(/\s+/g, ' ').trim(),
    };
  }

  // ABN AMRO: NAAM: ... OMSCHRIJVING: ...
  const name = /NAAM:\s*(.*?)(?:\s{2,}|OMSCHRIJVING:|KENMERK:|$)/.exec(flat)?.[1] || '';
  const description = /OMSCHRIJVING:\s*(.*?)(?:\s{2,}KENMERK:|$)/.exec(flat)?.[1] || flat;
  const iban = /\b([A-Z]{2}\d{2}[A-Z]{4}\d{6,20})\b/.exec(flat)?.[1] || '';
  return { counterparty_name: name.trim(), counterparty_iban: iban, description: description.replace(/\s+/g, ' ').trim() };
}

function parseMt940(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let current: ParsedStatement | null = null;
  let pending: { booked_on: string; amount: number; reference: string } | null = null;

  // Elk veld begint met :nn: aan het begin van een regel; volgregels horen erbij
  const fields = text.replace(/\r/g, '').split(/\n(?=:\d{2}[A-Z]?:)/);

  const flush = (info = '') => {
    if (!current || !pending) return;
    const parsed = parseMt86(info);
    current.transactions.push({
      booked_on: pending.booked_on,
      amount: pending.amount,
      ...parsed,
      external_id: pending.reference && pending.reference !== 'NONREF'
        ? `r:${pending.reference}`
        : fingerprint([pending.booked_on, pending.amount, parsed.counterparty_iban, parsed.description]),
    });
    pending = null;
  };

  for (const raw of fields) {
    const match = /^:(\d{2}[A-Z]?):([\s\S]*)$/.exec(raw.trim());
    if (!match) continue;
    const [, code, value] = match;

    if (code === '25') {
      flush();
      const iban = /([A-Z]{2}\d{2}[A-Z0-9]{10,30}?)(?:EUR)?$/.exec(value.replace(/\s/g, ''))?.[1] || value.trim();
      current = statements.find(s => s.iban === iban) || null;
      if (!current) {
        current = { iban, opening_balance: null, opening_date: null, transactions: [] };
        statements.push(current);
      }
    } else if ((code === '60F' || code === '60M') && current && current.opening_balance === null) {
      const balance = /^([CD])(\d{6})[A-Z]{3}([\d,]+)/.exec(value.trim());
      if (balance) {
        current.opening_balance = cents(balance[1] === 'D' ? -mtAmount(balance[3]) : mtAmount(balance[3]));
        current.opening_date = mtDate(balance[2]);
      }
    } else if (code === '61' && current) {
      flush();
      const line = /^(\d{6})(\d{4})?(R?[CD])[A-Z]?([\d,]+)N?\w{3}([^\n/]*)/.exec(value.trim());
      if (line) {
        const debit = line[3].endsWith('D') !== line[3].startsWith('R');
        const amount = cents(mtAmount(line[4]));
        pending = { booked_on: mtDate(line[1]), amount: debit ? -amount : amount, reference: (line[5] || '').trim() };
      }
    } else if (code === '86') {
      flush(value);
    }
  }
  flush();

  return statements.map(s => ({ ...s, transactions: uniqueIds(s.transactions) }));
}

/** Leest een afschrift; gooit een leesbare fout als het geen CAMT.053 of MT940 is */
export function parseStatement(content: string): ParsedStatement[] {
  const text = content.replace(/^\uFEFF/, '');
  const statements = /<(\w+:)?Ntry[\s>]/.test(text) || /camt\.05[23]/.test(text)
    ? parseCamt(text)
    : /:61:/.test(text)
      ? parseMt940(text)
      : [];

  const usable = statements.filter(s => s.iban);
  if (usable.length === 0) {
    throw new Error('Dit lijkt geen bankafschrift. Download in je bank-app een afschrift als CAMT.053 (XML) of MT940.');
  }
  return usable;
}

// ---------- Opslaan ----------

/** De rekening bij een IBAN, en anders een nieuwe */
async function accountFor(tenantId: string, iban: string, name?: string | null): Promise<BankAccount> {
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('iban', iban)
    .maybeSingle();
  if (existing) return existing as BankAccount;

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({ tenant_id: tenantId, iban, name: name || null })
    .select()
    .single();
  if (error) throw error;
  return data as BankAccount;
}

/**
 * Bewaart de transacties van een rekening; wat er al stond wordt overgeslagen.
 * Het beginsaldo onthouden we van het vroegste afschrift. Daarna worden de
 * nieuwe transacties waar mogelijk meteen aan een factuur of kostenpost gekoppeld.
 */
export async function saveStatement(
  tenantId: string,
  statement: ParsedStatement,
  account?: BankAccount
): Promise<{ imported: number; matched: number }> {
  const target = account || (await accountFor(tenantId, statement.iban));

  if (statement.opening_balance !== null && statement.opening_date &&
      (!target.opening_date || statement.opening_date < target.opening_date)) {
    await supabase
      .from('bank_accounts')
      .update({ opening_balance: statement.opening_balance, opening_date: statement.opening_date })
      .eq('id', target.id);
  }

  if (statement.transactions.length === 0) return { imported: 0, matched: 0 };

  const { data, error } = await supabase
    .from('bank_transactions')
    .upsert(
      statement.transactions.map(t => ({ ...t, tenant_id: tenantId, bank_account_id: target.id })),
      { onConflict: 'bank_account_id,external_id', ignoreDuplicates: true }
    )
    .select();
  if (error) throw error;

  const inserted = (data || []) as BankTransaction[];
  const matched = await autoMatch(tenantId, inserted);
  return { imported: inserted.length, matched };
}

/** Een afschrift inlezen en bewaren, met alle rekeningen erin */
export async function importStatement(tenantId: string, content: string) {
  const statements = parseStatement(content);
  let imported = 0;
  let matched = 0;
  for (const statement of statements) {
    const result = await saveStatement(tenantId, statement);
    imported += result.imported;
    matched += result.matched;
  }
  return { accounts: statements.length, imported, matched };
}

// ---------- Koppelen ----------

/** Tekst om in te zoeken: kleine letters, zonder spaties en leestekens */
const searchable = (value: string | null | undefined) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Koppelt nieuwe transacties aan wat er openstaat, alleen als het zeker is:
 *
 * - Geld binnen: een verstuurde factuur met precies dit bedrag, waarvan het
 *   factuurnummer in de omschrijving staat, of die als enige dit bedrag heeft
 *   en van een klant met dit IBAN komt. De factuur gaat op betaald.
 * - Geld af: een open kostenpost met precies dit bedrag, waarvan het
 *   factuurnummer in de omschrijving of de leverancier in de naam staat.
 *
 * Twijfel blijft "te verwerken"; dan koppelt de gebruiker zelf.
 */
async function autoMatch(tenantId: string, transactions: BankTransaction[]): Promise<number> {
  if (transactions.length === 0) return 0;

  const [{ data: invoices }, { data: expenses }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total, customer:customers(iban)')
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .gt('total', 0),
    supabase
      .from('expenses')
      .select('id, supplier, reference, total')
      .eq('tenant_id', tenantId)
      .eq('status', 'open'),
  ]);

  const openInvoices = [...(invoices || [])] as any[];
  const openExpenses = [...(expenses || [])] as any[];
  let matched = 0;

  for (const transaction of transactions) {
    const text = searchable(`${transaction.description} ${transaction.counterparty_name}`);
    const amount = Number(transaction.amount);

    if (amount > 0) {
      const sameAmount = openInvoices.filter(i => Number(i.total) === amount);
      const invoice =
        sameAmount.find(i => i.invoice_number && text.includes(searchable(i.invoice_number))) ||
        (sameAmount.length === 1 &&
        transaction.counterparty_iban &&
        searchable(sameAmount[0].customer?.iban) === searchable(transaction.counterparty_iban)
          ? sameAmount[0]
          : null);
      if (!invoice) continue;

      await linkTransaction(tenantId, transaction.id, { invoiceId: invoice.id });
      openInvoices.splice(openInvoices.indexOf(invoice), 1);
      matched++;
    } else if (amount < 0) {
      const sameAmount = openExpenses.filter(e => Number(e.total) === -amount);
      const expense = sameAmount.find(e => {
        if (e.reference && text.includes(searchable(e.reference))) return true;
        const supplier = searchable(e.supplier);
        return supplier.length >= 3 && searchable(transaction.counterparty_name).includes(supplier);
      });
      if (!expense) continue;

      await linkTransaction(tenantId, transaction.id, { expenseId: expense.id });
      openExpenses.splice(openExpenses.indexOf(expense), 1);
      matched++;
    }
  }

  return matched;
}

/** Waar een transactie aan gekoppeld wordt; null maakt hem weer "te verwerken" */
export type TransactionLink = { invoiceId: number } | { expenseId: number } | { category: string } | null;

/**
 * Koppelt een transactie aan een factuur, een kostenpost of een categorie.
 *
 * Een factuur of kostenpost die nog openstond gaat op betaald, op de datum
 * van de transactie. Wordt de koppeling later weggehaald of veranderd, dan
 * gaat die weer terug naar open; wat al eerder betaald was blijft betaald.
 */
export async function linkTransaction(tenantId: string, transactionId: number | string, link: TransactionLink) {
  const { data: transaction, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('tenant_id', tenantId)
    .single();
  if (error || !transaction) throw new Error('Transactie niet gevonden');

  // Eerst de oude koppeling terugdraaien, als die iets op betaald had gezet
  if (transaction.settled) {
    if (transaction.invoice_id) {
      await updateInvoice(transaction.invoice_id, tenantId, { status: 'sent' });
    }
    if (transaction.expense_id) {
      await supabase
        .from('expenses')
        .update({ status: 'open', paid_at: null })
        .eq('id', transaction.expense_id)
        .eq('tenant_id', tenantId);
    }
  }

  const update: Partial<BankTransaction> = { invoice_id: null, expense_id: null, category: null, settled: false };

  if (link && 'invoiceId' in link) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', link.invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (!invoice) throw new Error('Factuur niet gevonden');

    update.invoice_id = invoice.id;
    if (invoice.status === 'sent') {
      await updateInvoice(invoice.id, tenantId, { status: 'paid', paid_at: transaction.booked_on });
      update.settled = true;
    }
  } else if (link && 'expenseId' in link) {
    const { data: expense } = await supabase
      .from('expenses')
      .select('id, status')
      .eq('id', link.expenseId)
      .eq('tenant_id', tenantId)
      .single();
    if (!expense) throw new Error('Kostenpost niet gevonden');

    update.expense_id = expense.id;
    if (expense.status === 'open') {
      await supabase
        .from('expenses')
        .update({ status: 'paid', paid_at: transaction.booked_on })
        .eq('id', expense.id)
        .eq('tenant_id', tenantId);
      update.settled = true;
    }
  } else if (link && 'category' in link) {
    if (!BANK_CATEGORIES.some(c => c.value === link.category)) throw new Error('Onbekende categorie');
    update.category = link.category;
  }

  const { data, error: updateError } = await supabase
    .from('bank_transactions')
    .update(update)
    .eq('id', transaction.id)
    .select()
    .single();
  if (updateError) throw updateError;
  return data as BankTransaction;
}

// ---------- Lezen ----------

/** De rekeningen met hun huidige saldo: beginsaldo plus alles wat erna kwam */
export async function getBankAccounts(tenantId: string) {
  const { data: accounts, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at');
  if (error) throw error;

  return Promise.all(
    ((accounts || []) as BankAccount[]).map(async (account) => {
      let query = supabase.from('bank_transactions').select('amount').eq('bank_account_id', account.id);
      if (account.opening_date) query = query.gte('booked_on', account.opening_date);
      const { data: amounts } = await query;
      const movement = (amounts || []).reduce((sum, t: any) => sum + Number(t.amount), 0);
      return {
        ...account,
        balance: account.opening_balance === null ? null : cents(Number(account.opening_balance) + movement),
      };
    })
  );
}

/** De transacties, nieuwste eerst, met waar ze aan gekoppeld zijn */
export async function getBankTransactions(tenantId: string, onlyOpen: boolean) {
  let query = supabase
    .from('bank_transactions')
    .select('*, invoice:invoices(id, invoice_number), expense:expenses(id, supplier)')
    .eq('tenant_id', tenantId)
    .order('booked_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(2000);

  if (onlyOpen) query = query.is('invoice_id', null).is('expense_id', null).is('category', null);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
