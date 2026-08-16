import type { Customer, DocumentBlock, DocumentElement, LineItem } from './supabase';

/** De velden waaruit een klantnaam opgebouwd wordt; meer is niet nodig. */
type NameParts = Pick<Customer, 'first_name' | 'middle_name' | 'last_name' | 'name' | 'company_name'>;

/**
 * De naam van de klant als persoon: voornaam, tussenvoegsel, achternaam.
 * Leeg als die velden niet gevuld zijn.
 */
export function getCustomerPersonName(customer: Partial<NameParts>): string {
  return [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ');
}

/**
 * De naam waarmee een klant overal in het systeem verschijnt: in de tabellen,
 * in de keuzelijsten en boven de offerte. Dat is de naam van de persoon; staat
 * die er niet, dan valt hij terug op het opgeslagen naamveld of de bedrijfsnaam.
 */
export function getCustomerDisplayName(customer: Partial<NameParts>): string {
  return (
    getCustomerPersonName(customer) || customer.name || customer.company_name || 'Naamloze klant'
  );
}

/** Naam met klantnummer erachter, voor de keuzelijsten: "Jan de Vries (K-1024)" */
export function getCustomerOptionLabel(customer: Partial<NameParts> & { customer_number?: string | null }): string {
  const name = getCustomerDisplayName(customer);
  return customer.customer_number ? `${name} (${customer.customer_number})` : name;
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

/** Bedragen op hele centen. */
const toCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Het eindbedrag: de som van alle prijstabellen in alle blokken.
 *
 * Elke tabel wordt eerst op centen afgerond, want dat is ook het bedrag dat
 * eronder staat. Zou je de onafgeronde bedragen optellen, dan kan het
 * eindtotaal een cent afwijken van wat de klant krijgt als hij de tabellen zelf
 * bij elkaar optelt. Afronden per BTW-tarief is ook hoe de btw hoort te lopen.
 */
export function calculateDocumentTotal(blocks: DocumentBlock[]): number {
  return toCents(
    blocks.reduce(
      (sum, block) =>
        sum + block.elements.reduce((s, element) => s + toCents(calculateElementTotals(element).total), 0),
      0
    )
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
