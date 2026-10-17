/**
 * Betalen per overschrijving, met een QR-code op de factuur.
 *
 * De code volgt de Europese standaard voor overschrijvingen (EPC-QR, ook wel
 * "GiroCode"): een bank-app die hem scant vult rekening, naam, bedrag en
 * omschrijving zelf in. Het geld gaat rechtstreeks naar de rekening van de
 * aannemer; er zit geen betaaldienst tussen en niemand hoeft een account.
 */

export interface PaymentRequest {
  /** Naam van de ontvanger, zoals op de rekening */
  name: string;
  iban: string;
  /** Bedrag in euro's */
  amount: number;
  /** Wat de klant als omschrijving meestuurt, zoals "Factuur 2026-001" */
  reference: string;
}

/** IBAN zonder spaties, in hoofdletters */
export function cleanIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** IBAN in groepjes van vier, zoals op een bankpas: NL91 ABNA 0417 1643 00 */
export function formatIban(iban: string): string {
  return cleanIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

/** Of er genoeg is om een betaalverzoek te maken */
export function canRequestPayment(request: Partial<PaymentRequest>): request is PaymentRequest {
  return !!request.name?.trim() && !!request.iban?.trim() && !!request.amount && request.amount > 0;
}

/**
 * De tekst in de QR-code, regel voor regel volgens de standaard (versie 002,
 * waarin de BIC mag ontbreken). Lengtes zijn begrensd zoals de standaard
 * voorschrijft, anders weigeren bank-apps de code.
 */
export function epcPayload({ name, iban, amount, reference }: PaymentRequest): string {
  return [
    'BCD', // vaste aanduiding
    '002', // versie
    '1', // tekenset UTF-8
    'SCT', // SEPA-overschrijving
    '', // BIC, mag leeg in versie 002
    name.trim().slice(0, 70),
    cleanIban(iban),
    `EUR${amount.toFixed(2)}`,
    '', // doelcode
    '', // gestructureerde referentie
    reference.trim().slice(0, 140),
  ].join('\n');
}

/** De omschrijving bij de betaling: het factuurnummer, of anders het nummer in Synbased */
export function invoiceReference(invoice: { id: number | string; invoice_number?: string | null }): string {
  return `Factuur ${invoice.invoice_number || invoice.id}`;
}
