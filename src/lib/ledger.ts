import { supabaseAdmin } from './supabase';
import { getVatOverview } from './db';
import { BANK_CATEGORIES, EXPENSE_CATEGORIES } from './constants';
import { categoryLabel, isVatDeductible } from './expenses';

/**
 * Het grootboek, onder water: dubbel boekhouden, afgeleid uit wat er al in
 * Synbased staat. Er is geen aparte tabel die bijgehouden moet worden; elke
 * keer rekenen we het opnieuw uit facturen, kosten en banktransacties. Zo kan
 * het nooit uit de pas lopen, en is debet altijd gelijk aan credit.
 *
 * - Een factuur: debiteuren aan omzet per tarief en te betalen btw.
 * - Betaald: bank aan debiteuren. Via Mollie eerst kruisposten aan
 *   debiteuren; de uitbetaling van Mollie op de bank (categorie
 *   "overboeking") boekt bank aan kruisposten.
 * - Een kostenpost: kosten en voorbelasting aan crediteuren. Niet
 *   aftrekbare btw (eten en drinken) hoort bij de kosten.
 * - Betaald: crediteuren aan bank.
 * - Een banktransactie met een categorie: bank tegen die rekening, zoals
 *   privé of bankkosten. Een transactie die nog niet verwerkt is staat op
 *   "te verwerken", zodat het banksaldo toch klopt.
 * - Het beginsaldo van een bankrekening: bank aan eigen vermogen.
 *
 * Een transactie die aan een factuur of kostenpost gekoppeld is, boekt zelf
 * niets: de betaling van die factuur of kostenpost doet dat al.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface LedgerAccount {
  code: string;
  name: string;
  type: AccountType;
}

/** Het rekeningschema: vast, plus een kostenrekening per categorie */
const ALL_ACCOUNTS: LedgerAccount[] = [
  { code: '0600', name: 'Privé', type: 'equity' },
  { code: '0900', name: 'Eigen vermogen', type: 'equity' },
  { code: '1000', name: 'Bank', type: 'asset' },
  { code: '1300', name: 'Debiteuren', type: 'asset' },
  { code: '1500', name: 'Te betalen btw', type: 'liability' },
  { code: '1510', name: 'Te vorderen btw (voorbelasting)', type: 'asset' },
  { code: '1520', name: 'Btw betaald aan of ontvangen van de Belastingdienst', type: 'liability' },
  { code: '1600', name: 'Crediteuren', type: 'liability' },
  { code: '2200', name: 'Kruisposten (onderweg, zoals Mollie)', type: 'asset' },
  { code: '2300', name: 'Te verwerken banktransacties', type: 'asset' },
  ...EXPENSE_CATEGORIES.map(c => ({ code: c.account, name: c.label, type: 'expense' as const })),
  { code: '8000', name: 'Omzet hoog tarief (21%)', type: 'revenue' },
  { code: '8010', name: 'Omzet laag tarief (9%)', type: 'revenue' },
  { code: '8020', name: 'Omzet 0% of niet bij u belast', type: 'revenue' },
  { code: '8030', name: 'Omzet overige tarieven', type: 'revenue' },
  { code: '8900', name: 'Overige inkomsten', type: 'revenue' },
];

/** Elke code één keer: bankkosten en overige kosten staan ook bij de categorieën */
export const ACCOUNTS = ALL_ACCOUNTS.filter((account, index) => ALL_ACCOUNTS.findIndex(a => a.code === account.code) === index);

/** Eén regel in het journaal: een bedrag debet of credit op een rekening */
export interface JournalLine {
  date: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
  /** Waar het vandaan komt, zoals "Factuur FAC-087" */
  source: string;
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

const revenueAccount = (rate: number) => (rate === 21 ? '8000' : rate === 9 ? '8010' : rate === 0 ? '8020' : '8030');
const expenseAccount = (category: string) => EXPENSE_CATEGORIES.find(c => c.value === category)?.account || '4990';
const bankCategoryAccount = (category: string) => BANK_CATEGORIES.find(c => c.value === category)?.account || '2300';

/**
 * Een boeking: debet en credit samen. Een negatief bedrag (zoals een
 * creditfactuur) draait de kant om, zodat geen regel negatief is.
 */
function post(lines: JournalLine[], date: string, source: string, description: string, debit: string, credit: string, amount: number) {
  const value = cents(amount);
  if (!value) return;
  const [from, to] = value > 0 ? [debit, credit] : [credit, debit];
  const abs = Math.abs(value);
  lines.push({ date, account: from, description, debit: abs, credit: 0, source });
  lines.push({ date, account: to, description, debit: 0, credit: abs, source });
}

/**
 * Het journaal tot en met een datum, vanaf het begin. Voor de winst-en-
 * verliesrekening filter je daarna op de periode; de balans telt alles op.
 */
export async function buildJournal(tenantId: string, to: string): Promise<JournalLine[]> {
  const lines: JournalLine[] = [];
  const { invoices, expenses } = await getVatOverview(tenantId, '1900-01-01', to);

  for (const invoice of invoices) {
    const source = `${invoice.credit_for_invoice_id ? 'Creditfactuur' : 'Factuur'} ${invoice.invoice_number || ''}`.trim();
    for (const rate of invoice.rates) {
      post(lines, invoice.invoice_date, source, `Omzet ${rate.rate}%`, '1300', revenueAccount(rate.rate), rate.base);
      post(lines, invoice.invoice_date, source, `Btw ${rate.rate}%`, '1300', '1500', rate.vat);
    }

    const paidOn = invoice.status === 'paid' && invoice.paid_at ? invoice.paid_at.slice(0, 10) : null;
    if (paidOn && paidOn <= to) {
      const total = cents(invoice.base + invoice.vat);
      post(lines, paidOn, source, invoice.mollie_payment_id ? 'Betaald via Mollie' : 'Betaald', invoice.mollie_payment_id ? '2200' : '1000', '1300', total);
    }
  }

  for (const expense of expenses) {
    const source = `Kosten ${expense.supplier}`;
    const nonDeductible = cents(expense.vat_amount - expense.deductible);
    post(lines, expense.expense_date, source, categoryLabel(expense.category), expenseAccount(expense.category), '1600', expense.total_excl + nonDeductible);
    if (isVatDeductible(expense.category)) {
      post(lines, expense.expense_date, source, 'Voorbelasting', '1510', '1600', expense.deductible);
    }

    const paidOn = expense.status === 'paid' && expense.paid_at ? expense.paid_at.slice(0, 10) : null;
    if (paidOn && paidOn <= to) post(lines, paidOn, source, 'Betaald', '1600', '1000', expense.total);
  }

  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabaseAdmin.from('bank_accounts').select('iban, opening_balance, opening_date').eq('tenant_id', tenantId),
    supabaseAdmin
      .from('bank_transactions')
      .select('booked_on, amount, counterparty_name, description, category, invoice_id, expense_id')
      .eq('tenant_id', tenantId)
      .lte('booked_on', to),
  ]);

  for (const account of accounts || []) {
    if (account.opening_balance === null || !account.opening_date || account.opening_date > to) continue;
    post(lines, account.opening_date, `Beginsaldo ${account.iban}`, 'Beginsaldo bank', '1000', '0900', Number(account.opening_balance));
  }

  for (const transaction of transactions || []) {
    // Gekoppeld aan een factuur of kostenpost: de betaling daarvan boekt al
    if (transaction.invoice_id || transaction.expense_id) continue;
    const counter = transaction.category ? bankCategoryAccount(transaction.category) : '2300';
    const description = transaction.description || transaction.counterparty_name || 'Banktransactie';
    post(lines, transaction.booked_on, `Bank ${transaction.counterparty_name || ''}`.trim(), description, '1000', counter, Number(transaction.amount));
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date));
}

/** Per rekening het saldo: debet min credit voor bezittingen en kosten, andersom voor de rest */
function balances(lines: JournalLine[]) {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.account, (totals.get(line.account) || 0) + line.debit - line.credit);

  return ACCOUNTS.map((account) => {
    const debitMinusCredit = cents(totals.get(account.code) || 0);
    const natural = account.type === 'asset' || account.type === 'expense' ? debitMinusCredit : -debitMinusCredit;
    return { ...account, amount: cents(natural) };
  }).filter(account => account.amount !== 0);
}

/**
 * De jaarcijfers van een jaar: de winst-en-verliesrekening over dat jaar en de
 * balans op 31 december, met het journaal erbij voor de export.
 */
export async function getAnnualFigures(tenantId: string, year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const journal = await buildJournal(tenantId, to);

  const yearLines = journal.filter(line => line.date >= from);
  const yearBalances = balances(yearLines);
  const revenue = yearBalances.filter(a => a.type === 'revenue');
  const costs = yearBalances.filter(a => a.type === 'expense');
  const totalRevenue = cents(revenue.reduce((sum, a) => sum + a.amount, 0));
  const totalCosts = cents(costs.reduce((sum, a) => sum + a.amount, 0));
  const result = cents(totalRevenue - totalCosts);

  // De balans: alles tot en met 31 december. Het resultaat van alle jaren
  // samen hoort bij het eigen vermogen; dit jaar apart, de rest daarvoor
  const allBalances = balances(journal);
  const allResult = cents(
    allBalances.filter(a => a.type === 'revenue').reduce((sum, a) => sum + a.amount, 0) -
      allBalances.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.amount, 0)
  );

  const assets = allBalances.filter(a => a.type === 'asset');
  const liabilities = allBalances.filter(a => a.type === 'liability');
  const equity = [
    ...allBalances.filter(a => a.type === 'equity'),
    { code: '', name: 'Resultaat voorgaande jaren', type: 'equity' as const, amount: cents(allResult - result) },
    { code: '', name: `Resultaat ${year}`, type: 'equity' as const, amount: result },
  ].filter(a => a.amount !== 0);

  return {
    year,
    revenue,
    costs,
    totalRevenue,
    totalCosts,
    result,
    assets,
    liabilities,
    equity,
    totalAssets: cents(assets.reduce((sum, a) => sum + a.amount, 0)),
    totalLiabilitiesAndEquity: cents([...liabilities, ...equity].reduce((sum, a) => sum + a.amount, 0)),
    journal: yearLines,
  };
}
