import { EXPENSE_CATEGORIES, VAT_RATES } from './constants';
import type { ExpenseLine } from './supabase';

/**
 * De regels rond een kostenpost, voor het scherm en de API allebei.
 *
 * Een kostenpost heeft een of meer regels, elk met een eigen btw-tarief, zoals
 * ze onderaan een bonnetje staan. De bedragen van de kostenpost zelf zijn
 * altijd de som van de regels.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** De btw bij een bedrag exclusief btw, op centen */
export function vatFor(amountExcl: number, rate: number): number {
  return cents(((Number(amountExcl) || 0) * (Number(rate) || 0)) / 100);
}

/** De naam van een categorie, of de code zelf als hij niet (meer) bestaat */
export function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;
}

/** Of de btw van deze categorie als voorbelasting mag; bij eten en drinken niet */
export function isVatDeductible(category: string): boolean {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.vatDeductible !== false;
}

/**
 * De velden en regels uit een verzoek, gecontroleerd. Geeft een melding als er
 * iets niet klopt; die is voor de gebruiker.
 */
export function expenseFromBody(body: any): {
  fields: Record<string, any>;
  lines?: ExpenseLine[];
  problem?: string;
} {
  const fields: Record<string, any> = {};

  if (!String(body?.supplier || '').trim()) return { fields, problem: 'Vul de leverancier in' };
  if (!DATE.test(String(body?.expense_date || ''))) return { fields, problem: 'Vul de datum in' };

  fields.supplier = String(body.supplier).trim();
  fields.expense_date = body.expense_date;
  fields.reference = String(body.reference || '').trim() || null;
  fields.description = String(body.description || '').trim() || null;
  fields.due_date = DATE.test(String(body.due_date || '')) ? body.due_date : null;
  fields.category = EXPENSE_CATEGORIES.some(c => c.value === body.category) ? body.category : 'other';
  fields.status = body.status === 'paid' ? 'paid' : 'open';
  fields.paid_at = fields.status === 'paid' ? (DATE.test(String(body.paid_at || '')) ? body.paid_at : body.expense_date) : null;

  const lines: ExpenseLine[] = (Array.isArray(body.lines) ? body.lines : [])
    .map((line: any) => ({
      description: String(line?.description || ''),
      amount_excl: cents(Number(line?.amount_excl) || 0),
      vat_rate: (VAT_RATES as readonly number[]).includes(Number(line?.vat_rate)) ? Number(line.vat_rate) : 21,
      vat_amount: cents(Number(line?.vat_amount) || 0),
    }))
    .filter((line: ExpenseLine) => line.amount_excl !== 0 || line.vat_amount !== 0);

  if (lines.length === 0) return { fields, problem: 'Vul een bedrag in' };

  return { fields, lines };
}
