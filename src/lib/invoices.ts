import { formatDate } from './utils';

/**
 * De regels rond een factuur die de deur uit is.
 *
 * Volgens de Belastingdienst mag een verstuurde factuur niet meer veranderen.
 * Zit er een fout in, dan maak je een creditfactuur: een nieuwe factuur met
 * min-bedragen die naar de oude verwijst. Een concept mag nog alles.
 */

interface InvoiceState {
  status: string;
}

interface CreditLink {
  credit_for_invoice_id?: number | null;
}

/**
 * Of de factuur vastligt: alles behalve een concept. Verstuurd, betaald of
 * geannuleerd betekent dat hij bij de klant (of in de boekhouding) ligt.
 */
export function isFinalInvoice(invoice: InvoiceState): boolean {
  return invoice.status !== 'draft';
}

/** Een creditfactuur draait (een deel van) een andere factuur terug */
export function isCreditNote(invoice: CreditLink): boolean {
  return !!invoice.credit_for_invoice_id;
}

/** "Factuur" of "Creditfactuur", voor de kop, het onderwerp en de bestandsnaam */
export function invoiceTitle(invoice: CreditLink): 'Factuur' | 'Creditfactuur' {
  return isCreditNote(invoice) ? 'Creditfactuur' : 'Factuur';
}

/** De melding als iemand een vastliggende factuur toch probeert te wijzigen */
export const FINAL_INVOICE_ERROR =
  'Deze factuur is verstuurd en kan niet meer gewijzigd worden. Maak een creditfactuur om hem te corrigeren.';

/**
 * De gegevens rechtsboven op het document. Een creditfactuur noemt de factuur
 * die hij corrigeert, en heeft geen vervaldatum.
 */
export function invoiceMeta(
  invoice: { invoice_number?: string | null; invoice_date?: string | null; due_date?: string | null },
  creditFor?: { invoice_number?: string | null } | null
): { label: string; value: string }[] {
  return [
    // Een concept krijgt zijn nummer pas bij het vastleggen
    { label: 'Factuurnummer', value: invoice.invoice_number || 'Volgt bij versturen' },
    ...(creditFor ? [{ label: 'Bij factuur', value: creditFor.invoice_number || '' }] : []),
    { label: 'Factuurdatum', value: formatDate(invoice.invoice_date) },
    ...(creditFor ? [] : [{ label: 'Vervaldatum', value: formatDate(invoice.due_date) }]),
  ];
}
