import type { Customer, DocumentBlock, DocumentElement, LineItem } from './supabase';

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
 * Bereken de bedragen van één prijstabel. Elke tabel heeft een eigen
 * BTW-tarief, zodat 9% schilderwerk en 21% overig werk elk hun eigen subtotaal
 * krijgen. Eén bron van waarheid voor de browser en de API.
 */
export function calculateElementTotals(element: Pick<DocumentElement, 'items' | 'tax_percentage' | 'discount_percentage' | 'kind'>) {
  if (element.kind !== 'prijstabel') {
    return { subtotal: 0, discount: 0, tax: 0, total: 0 };
  }

  const subtotal = element.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = (subtotal * (Number(element.discount_percentage) || 0)) / 100;
  const taxableAmount = subtotal - discount;
  const tax = (taxableAmount * (Number(element.tax_percentage) || 0)) / 100;

  return {
    subtotal,
    discount,
    tax,
    total: taxableAmount + tax,
  };
}

/** Het eindbedrag: de som van alle prijstabellen in alle blokken. */
export function calculateDocumentTotal(blocks: DocumentBlock[]): number {
  return blocks.reduce(
    (sum, block) =>
      sum + block.elements.reduce((s, element) => s + calculateElementTotals(element).total, 0),
    0
  );
}

/** Alle prijstabellen uit alle blokken, in volgorde. */
export function allPriceTables(blocks: DocumentBlock[]): DocumentElement[] {
  return blocks.flatMap(block => block.elements.filter(e => e.kind === 'prijstabel'));
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
