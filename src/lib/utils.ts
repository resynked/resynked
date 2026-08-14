import type { Customer, LineItem } from './supabase';

/**
 * Get display name for a customer
 * Returns company name (company_name is required field)
 */
export function getCustomerDisplayName(customer: Customer): string {
  return customer.company_name || customer.name || 'Naamloos bedrijf';
}

/**
 * Bereken de bedragen van een offerte of factuur.
 * Eén bron van waarheid voor zowel de preview in de browser als de API.
 */
export function calculateTotals(
  items: Pick<LineItem, 'quantity' | 'price'>[],
  taxPercentage: number,
  discountPercentage: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0
  );
  const discount = (subtotal * (discountPercentage || 0)) / 100;
  const taxableAmount = subtotal - discount;
  const tax = (taxableAmount * (taxPercentage || 0)) / 100;

  return {
    subtotal,
    discount,
    tax,
    total: taxableAmount + tax,
  };
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
