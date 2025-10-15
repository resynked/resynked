import type { Customer } from './supabase';

/**
 * Get display name for a customer
 * Returns company name (company_name is required field)
 */
export function getCustomerDisplayName(customer: Customer): string {
  return customer.company_name || customer.name || 'Naamloos bedrijf';
}
