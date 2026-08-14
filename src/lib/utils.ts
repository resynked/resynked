import type { Customer, DocumentBlock, LineItem } from './supabase';

/**
 * Get display name for a customer
 * Returns company name (company_name is required field)
 */
export function getCustomerDisplayName(customer: Customer): string {
  return customer.company_name || customer.name || 'Naamloos bedrijf';
}

/** Het bedrag van één regel. Een tussenkop telt niet mee. */
export function lineTotal(item: Pick<LineItem, 'quantity' | 'price' | 'is_heading'>): number {
  if (item.is_heading) return 0;
  return (Number(item.quantity) || 0) * (Number(item.price) || 0);
}

/**
 * Bereken de bedragen van één blok. Elk blok heeft een eigen BTW-tarief,
 * zodat 9% schilderwerk en 21% overig werk elk hun eigen subtotaal krijgen.
 * Eén bron van waarheid voor zowel de preview in de browser als de API.
 */
export function calculateBlockTotals(block: Pick<DocumentBlock, 'items' | 'tax_percentage' | 'discount_percentage' | 'kind'>) {
  if (block.kind === 'tekst') {
    return { subtotal: 0, discount: 0, tax: 0, total: 0 };
  }

  const subtotal = block.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = (subtotal * (Number(block.discount_percentage) || 0)) / 100;
  const taxableAmount = subtotal - discount;
  const tax = (taxableAmount * (Number(block.tax_percentage) || 0)) / 100;

  return {
    subtotal,
    discount,
    tax,
    total: taxableAmount + tax,
  };
}

/** Het eindbedrag van een offerte of factuur: de som van alle bloktotalen. */
export function calculateDocumentTotal(blocks: Pick<DocumentBlock, 'items' | 'tax_percentage' | 'discount_percentage' | 'kind'>[]): number {
  return blocks.reduce((sum, block) => sum + calculateBlockTotals(block).total, 0);
}

/** Bedrag als € 1.234,56 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(amount || 0);
}

/** Datum als 14-08-2026 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('nl-NL');
}
