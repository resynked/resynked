import { supabaseAdmin } from './supabase';
import type { Customer, DocumentBlock, Invoice, Quote, Tenant, Note, Product } from './supabase';
import { calculateDocumentTotal, lineTotal } from './utils';
import { copyBlocks } from './blocks';
import { isCreditNote, isFinalInvoice } from './invoices';
import { isCountable, nextNumber } from './numbering';

// Use supabaseAdmin for all database operations since we handle auth via NextAuth
const supabase = supabaseAdmin;

// Helper function to get updated_at timestamp
const now = () => new Date().toISOString();

/**
 * Vandaag in Nederland, als jjjj-mm-dd. De server draait op Greenwich-tijd,
 * dus daar is het 's avonds al de volgende dag — en zou een factuur die om
 * elf uur 's avonds gemaakt wordt de datum van morgen krijgen.
 */
export const vandaagHier = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());

/** Een aantal dagen bij een datum van de vorm jjjj-mm-dd. */
export const dagenErbij = (datum: string, aantal: number) => {
  const [jaar, maand, dag] = datum.split('-').map(Number);
  return new Date(Date.UTC(jaar, maand - 1, dag + aantal)).toISOString().split('T')[0];
};

/** Offertes en facturen zijn identiek opgebouwd, alleen de tabellen verschillen. */
type Soort = 'quote' | 'invoice';

function tablesFor(soort: Soort) {
  return soort === 'quote'
    ? { blocksTable: 'quote_blocks', elementsTable: 'quote_elements', itemsTable: 'quote_items', parentKey: 'quote_id' }
    : { blocksTable: 'invoice_blocks', elementsTable: 'invoice_elements', itemsTable: 'invoice_items', parentKey: 'invoice_id' };
}

/**
 * Slaat de blokken van een offerte of factuur op. Bestaande blokken gaan er
 * eerst uit; elementen en regels verdwijnen mee door de cascade. Daarna gaan
 * de blokken erin, met hun elementen en de regels van elke prijstabel.
 */
async function saveBlocks(
  soort: Soort,
  parentId: number | string,
  tenantId: string,
  blocks: DocumentBlock[]
) {
  const { blocksTable, elementsTable, itemsTable, parentKey } = tablesFor(soort);

  const { error: deleteError } = await supabase
    .from(blocksTable)
    .delete()
    .eq(parentKey, parentId)
    .eq('tenant_id', tenantId);

  if (deleteError) throw deleteError;

  if (blocks.length === 0) return;

  const { data: savedBlocks, error: blockError } = await supabase
    .from(blocksTable)
    .insert(
      blocks.map((block, index) => ({
        [parentKey]: parentId,
        tenant_id: tenantId,
        title: (block.title || '').trim(),
        position: index,
      }))
    )
    .select('id, position');

  if (blockError) throw blockError;

  // De ids komen niet gegarandeerd op volgorde terug, dus koppelen we op
  // position — die hebben we hierboven zelf gezet
  const blockIdByPosition = new Map<number, number>(
    (savedBlocks || []).map((row: any) => [row.position, row.id])
  );

  const elementRows: any[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockId = blockIdByPosition.get(blockIndex);
    if (!blockId) return;

    block.elements.forEach((element, elementIndex) => {
      elementRows.push({
        block_id: blockId,
        tenant_id: tenantId,
        kind: element.kind,
        body: element.kind === 'tekst' || element.kind === 'kop' ? element.body || null : null,
        tax_percentage: Number(element.tax_percentage) || 0,
        discount_percentage: Number(element.discount_percentage) || 0,
        show_quantity: !!element.show_quantity,
        position: elementIndex,
      });
    });
  });

  if (elementRows.length === 0) return;

  const { data: savedElements, error: elementError } = await supabase
    .from(elementsTable)
    .insert(elementRows)
    .select('id, block_id, position');

  if (elementError) {
    console.error(`Elementen van ${soort} ${parentId} niet op te slaan —`, elementError);
    throw describeElementError(elementError) || elementError;
  }

  // Terugkoppelen op de combinatie blok en plek binnen dat blok
  const elementIdByKey = new Map<string, number>(
    (savedElements || []).map((row: any) => [`${row.block_id}-${row.position}`, row.id])
  );

  const itemRows = blocks.flatMap((block, blockIndex) => {
    const blockId = blockIdByPosition.get(blockIndex);
    if (!blockId) return [];

    return block.elements.flatMap((element, elementIndex) => {
      if (element.kind !== 'prijstabel') return [];

      const elementId = elementIdByKey.get(`${blockId}-${elementIndex}`);
      if (!elementId) return [];

      return element.items.map((item, itemIndex) => ({
        element_id: elementId,
        tenant_id: tenantId,
        description: (item.description || '').trim(),
        is_heading: !!item.is_heading,
        quantity: item.is_heading ? 0 : Number(item.quantity) || 0,
        unit: item.is_heading ? null : item.unit || null,
        price: item.is_heading ? 0 : Number(item.price) || 0,
        total: lineTotal(item),
        position: itemIndex,
      }));
    });
  });

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from(itemsTable).insert(itemRows);
    if (itemsError) throw itemsError;
  }
}

const byPosition = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);

/** Zet de genest opgehaalde blokken, elementen en regels op volgorde. */
function sortBlocks(blocks: any[] | null | undefined) {
  if (!blocks) return [];

  return [...blocks].sort(byPosition).map((block) => ({
    ...block,
    elements: [...(block.elements || [])].sort(byPosition).map((element: any) => ({
      ...element,
      items: [...(element.items || [])].sort(byPosition),
    })),
  }));
}

const ELEMENT_COLUMNS = 'id, kind, body, tax_percentage, discount_percentage, show_quantity, position';
const ITEM_COLUMNS = 'id, description, is_heading, quantity, unit, price, total, position';

/** De klantvelden die bij een offerte, factuur of notitie meekomen. */
const CUSTOMER_SUMMARY = 'id, name, first_name, middle_name, last_name, company_name, customer_number, email';

/**
 * PostgREST kent de elementen-tabellen niet als MIGRATION.sql nog niet
 * gedraaid heeft: dan komt er 42P01 (tabel bestaat niet) of PGRST200
 * (geen relatie gevonden) terug in plaats van rijen.
 */
function isMissingElementsTable(error: any): boolean {
  return error?.code === 'PGRST200' || error?.code === '42P01';
}

const MIGRATION_NEEDED =
  'De database mist de elementen-tabellen. Draai MIGRATION.sql in de Supabase SQL-editor.';

const KIND_NOT_ALLOWED =
  'De database kent nog niet alle elementtypes. Draai MIGRATION.sql in de Supabase SQL-editor.';

/**
 * Maakt van een schemafout bij het opslaan van elementen een melding die zegt
 * wat er te doen valt, in plaats van de kale tekst van Postgres. Geeft null
 * terug als de fout niets met het schema te maken heeft.
 */
function describeElementError(error: any): Error | null {
  if (isMissingElementsTable(error)) return new Error(MIGRATION_NEEDED);

  // 23514 is een geweigerde CHECK. In de praktijk is dat een 'kind' dat de
  // database nog niet toestaat omdat zijn check ouder is dan de code; een
  // onbekend type is er dan al door validateBlocks uitgehaald.
  if (error?.code === '23514') return new Error(KIND_NOT_ALLOWED);

  return null;
}

/**
 * Haalt de blokken van een offerte of factuur op, met de elementen en de regels
 * van elke prijstabel erin. Dit gebeurt los van het document zelf: zo blijft
 * duidelijk waar een fout vandaan komt, en kan een database die de elementen
 * nog niet heeft terugvallen op de oude vorm.
 */
async function fetchBlocks(soort: Soort, parentId: number | string, tenantId: string) {
  const { blocksTable, elementsTable, itemsTable, parentKey } = tablesFor(soort);

  const { data, error } = await supabase
    .from(blocksTable)
    .select(
      `id, title, position, elements:${elementsTable}(${ELEMENT_COLUMNS}, items:${itemsTable}(${ITEM_COLUMNS}))`
    )
    .eq(parentKey, parentId)
    .eq('tenant_id', tenantId);

  if (!error) return sortBlocks(data);
  if (!isMissingElementsTable(error)) throw error;

  return fetchLegacyBlocks(soort, parentId, tenantId);
}

/**
 * Leest de blokken zoals ze eruitzagen vóór MIGRATION.sql: een blok was zelf
 * tekst of prijstabel, en de regels hingen aan het blok. Elk blok
 * wordt hier één element — precies wat de migratie ook doet — zodat een offerte
 * uit een nog niet bijgewerkte database toch te openen is.
 */
async function fetchLegacyBlocks(soort: Soort, parentId: number | string, tenantId: string) {
  const { blocksTable, itemsTable, parentKey } = tablesFor(soort);

  const { data, error } = await supabase
    .from(blocksTable)
    .select(
      `id, title, position, kind, body, tax_percentage, discount_percentage, items:${itemsTable}(${ITEM_COLUMNS})`
    )
    .eq(parentKey, parentId)
    .eq('tenant_id', tenantId);

  // Ook de oude vorm past niet: dan is er echt iets mis met het schema
  if (error) {
    console.error(`Blokken van ${soort} ${parentId} niet leesbaar —`, error);
    throw new Error(MIGRATION_NEEDED);
  }

  return [...(data || [])].sort(byPosition).map((block: any) => ({
    id: block.id,
    title: block.title || '',
    position: block.position,
    elements: [
      {
        kind: block.kind === 'tekst' ? 'tekst' : 'prijstabel',
        body: block.body ?? null,
        tax_percentage: Number(block.tax_percentage) || 0,
        discount_percentage: Number(block.discount_percentage) || 0,
        show_quantity: false,
        position: 0,
        items: [...(block.items || [])].sort(byPosition),
      },
    ],
  }));
}

// Tenants: bedrijfsgegevens van de aannemer zelf
export async function getTenant(tenantId: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  return data as Tenant;
}

export async function updateTenant(tenantId: string, updates: Partial<Tenant>) {
  const { data, error } = await supabase
    .from('tenants')
    .update({ ...updates, updated_at: now() })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Tenant;
}

/**
 * Pakt het eerstvolgende nummer uit de eigen nummering van de aannemer en zet
 * de teller door. Geeft null terug als er geen nummering is ingesteld.
 *
 * De teller wordt alleen opgehoogd als hij nog op hetzelfde nummer staat als
 * bij het lezen. Slaan twee mensen tegelijk op, dan krijgt de tweede geen rij
 * terug en probeert hij het opnieuw met het volgende nummer — zo krijgen twee
 * facturen nooit hetzelfde nummer.
 */
export async function takeDocumentNumber(tenantId: string, soort: Soort): Promise<string | null> {
  const column = soort === 'quote' ? 'quote_number_next' : 'invoice_number_next';

  for (let poging = 0; poging < 5; poging++) {
    const { data, error } = await supabase
      .from('tenants')
      .select(column)
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    const stored = (data as any)?.[column];
    if (!isCountable(stored)) return null;

    const number = String(stored).trim();

    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({ [column]: nextNumber(number), updated_at: now() })
      .eq('id', tenantId)
      .eq(column, stored)
      .select('id');

    if (updateError) throw updateError;
    if (updated && updated.length > 0) return number;
  }

  throw new Error('Kon geen nummer toekennen. Probeer het opnieuw.');
}

/**
 * Geeft een nummer terug aan de teller als het het laatst uitgedeelde was, zodat
 * het volgende document het weer krijgt en er geen gat in de reeks valt. Staat
 * de teller al verder, dan gebeurt er niets: dat nummer komt niet meer terug.
 */
export async function releaseDocumentNumber(tenantId: string, soort: Soort, number?: string | null) {
  if (!number || !isCountable(number)) return;

  const column = soort === 'quote' ? 'quote_number_next' : 'invoice_number_next';
  const value = number.trim();

  const { error } = await supabase
    .from('tenants')
    .update({ [column]: value, updated_at: now() })
    .eq('id', tenantId)
    .eq(column, nextNumber(value));

  if (error) throw error;
}

/**
 * Zonder eigen nummering zet de eerste vastgelegde factuur de teller zelf op
 * FT plus een getal, verder dan de FT-nummers die er al zijn. Daarna telt hij
 * door zoals een eigen nummering, en staat hij ook bij Instellingen.
 */
async function startInvoiceNumbering(tenantId: string) {
  const tenant = await getTenant(tenantId);
  const stored = tenant.invoice_number_next;

  if ((stored || '').trim()) {
    throw new Error('Het volgende factuurnummer bij Instellingen eindigt niet op cijfers, dus het systeem kan niet verder tellen. Pas het daar aan.');
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .like('invoice_number', 'FT%');

  if (error) throw error;

  const highest = Math.max(
    10000,
    ...(data || []).map(row => Number(/^FT(\d+)$/.exec(row.invoice_number || '')?.[1]) || 0)
  );

  // Alleen als hij nog leeg is; was iemand anders net eerder, dan telt die teller
  let query = supabase
    .from('tenants')
    .update({ invoice_number_next: `FT${highest + 1}`, updated_at: now() })
    .eq('id', tenantId);
  query = stored === null ? query.is('invoice_number_next', null) : query.eq('invoice_number_next', stored);

  const { error: updateError } = await query;
  if (updateError) throw updateError;
}

/**
 * Geeft een factuur zijn nummer, op het moment dat hij vastgelegd wordt. Een
 * concept heeft nog geen nummer: zo kan een concept weg zonder dat er een gat
 * in de reeks valt, en lopen de nummers van verstuurde facturen altijd door.
 * Heeft de factuur al een nummer, dan blijft dat.
 */
export async function assignInvoiceNumber(id: string | number, tenantId: string): Promise<string> {
  const { data: current, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  if (current.invoice_number) return current.invoice_number;

  let number = await takeDocumentNumber(tenantId, 'invoice');
  if (!number) {
    await startInvoiceNumbering(tenantId);
    number = await takeDocumentNumber(tenantId, 'invoice');
  }
  if (!number) throw new Error('Kon geen factuurnummer toekennen. Probeer het opnieuw.');

  const { data: updated, error: updateError } = await supabase
    .from('invoices')
    .update({ invoice_number: number, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('invoice_number', null)
    .select('invoice_number');

  if (updateError) throw updateError;
  if (updated && updated.length > 0) return number;

  // Tegelijk al een nummer gekregen, bijvoorbeeld door twee keer klikken: dit
  // nummer gaat terug en het nummer dat er al staat blijft
  await releaseDocumentNumber(tenantId, 'invoice', number);
  return assignInvoiceNumber(id, tenantId);
}

/**
 * Het nummer waaronder een offerte of factuur opgeslagen wordt. Heeft iemand in
 * het scherm zelf een ander nummer ingetypt, dan wint dat en blijft de teller
 * staan waar hij staat.
 */
export async function resolveDocumentNumber(
  tenantId: string,
  soort: Soort,
  submitted?: string | null
): Promise<string> {
  const typed = (submitted || '').trim();
  const tenant = await getTenant(tenantId);
  const counter = (soort === 'quote' ? tenant.quote_number_next : tenant.invoice_number_next) || '';

  if (typed && typed !== counter.trim()) return typed;

  return (await takeDocumentNumber(tenantId, soort)) || typed;
}

// Customers
export async function getCustomers(tenantId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    // Op klantnummer; wie er nog geen heeft komt onderaan
    .order('customer_number', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Customer[];
}

export async function getCustomer(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customer, updated_at: now() })
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string | number, tenantId: string, updates: Partial<Customer>) {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string | number, tenantId: string) {
  // Een klant met offertes of facturen mag niet zomaar verdwijnen
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id')
    .eq('customer_id', id)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (invoicesError) throw invoicesError;

  if (invoices && invoices.length > 0) {
    throw new Error('Deze klant heeft nog facturen en kan niet verwijderd worden');
  }

  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('id')
    .eq('customer_id', id)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (quotesError) throw quotesError;

  if (quotes && quotes.length > 0) {
    throw new Error('Deze klant heeft nog offertes en kan niet verwijderd worden');
  }

  const { error: notesError } = await supabase
    .from('notes')
    .delete()
    .eq('customer_id', id)
    .eq('tenant_id', tenantId);

  if (notesError) throw notesError;

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// Quotes
export async function getQuotes(tenantId: string, customerId?: number | string) {
  let query = supabase
    .from('quotes')
    .select(`
      *,
      customer:customers(${CUSTOMER_SUMMARY})
    `)
    .eq('tenant_id', tenantId)
    // Op offertenummer, nieuwste bovenaan
    .order('quote_number', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Voor het overzicht bij één klant
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getQuote(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, customer:customers(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Offerte niet gevonden');

  return { ...(data as any), blocks: await fetchBlocks('quote', id, tenantId) };
}

export async function createQuote(
  quote: Omit<Quote, 'id' | 'created_at' | 'updated_at'>,
  blocks: DocumentBlock[]
) {
  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .insert({ ...quote, updated_at: now() })
    .select()
    .single();

  if (quoteError) throw quoteError;

  await saveBlocks('quote', quoteData.id, quote.tenant_id, blocks);

  return quoteData as Quote;
}

export async function updateQuote(
  id: string | number,
  tenantId: string,
  updates: Partial<Quote>,
  blocks?: DocumentBlock[]
) {
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  // Blokken worden in hun geheel vervangen als ze meegestuurd zijn
  if (Array.isArray(blocks)) {
    await saveBlocks('quote', id, tenantId, blocks);
  }

  return data as Quote;
}

export async function deleteQuote(id: string | number, tenantId: string) {
  const { data: current } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;

  // Was dit de laatste offerte, dan krijgt de volgende zijn nummer weer
  await releaseDocumentNumber(tenantId, 'quote', current?.quote_number);
  return { success: true };
}

/**
 * Zoekt een offerte op zijn publieke sleutel, voor de pagina waar de klant hem
 * bekijkt en ondertekent. Er is hier geen sessie: de sleutel is het enige
 * bewijs, dus er gaat niet meer mee dan die pagina nodig heeft. De tenant komt
 * apart mee voor het logo en het sjabloon.
 */
export async function getQuoteByToken(token: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, tenant_id, quote_number, quote_date, valid_until, total, status, currency, ' +
        'signed_at, signed_name, signature_image, viewed_at, view_count, ' +
        'customer:customers(name, first_name, middle_name, last_name, company_name, street_address, postal_code, city)'
    )
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const quote = data as any;
  const tenant = await getTenant(quote.tenant_id);

  return {
    quote: { ...quote, blocks: await fetchBlocks('quote', quote.id, quote.tenant_id) },
    tenant,
  };
}

/**
 * Een factuur via de sleutel uit de mail, voor de pagina waar de klant hem
 * bekijkt en betaalt. Zonder sessie, dus alleen wat die pagina nodig heeft.
 */
export async function getInvoiceByToken(token: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, tenant_id, invoice_number, invoice_date, due_date, total, status, currency, paid_at, ' +
        'customer:customers(name, first_name, middle_name, last_name, company_name, street_address, postal_code, city)'
    )
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const invoice = data as any;
  const tenant = await getTenant(invoice.tenant_id);

  const creditFor = await findCreditFor(invoice.id, invoice.tenant_id);

  return {
    invoice: {
      ...invoice,
      blocks: await fetchBlocks('invoice', invoice.id, invoice.tenant_id),
      credit_for_invoice_id: creditFor?.id ?? null,
      credit_for: creditFor,
    },
    tenant,
  };
}

/**
 * Bij een creditfactuur: de factuur die hij corrigeert. Los opgevraagd, en een
 * fout telt als "geen creditfactuur": de pagina die de klant opent en de
 * QR-code in de mail mogen niet stuk, ook niet als MIGRATION.sql onderdeel 16
 * nog niet gedraaid is.
 */
async function findCreditFor(invoiceId: number, tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('credit_for_invoice_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !data?.credit_for_invoice_id) return null;

  const { data: original } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', data.credit_for_invoice_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return original ?? null;
}

/**
 * De klant heeft zijn offerte geopend: de eerste keer onthouden we, de laatste
 * keer en het aantal tellen door. Zo ziet de aannemer wanneer hij kan bellen.
 */
export async function recordQuoteView(id: number, viewCount: number, viewedAt: string | null) {
  const now = new Date().toISOString();
  await supabase
    .from('quotes')
    .update({ viewed_at: viewedAt || now, last_viewed_at: now, view_count: viewCount + 1 })
    .eq('id', id);
}

/**
 * Legt de handtekening van de klant vast. Een offerte kan maar één keer
 * getekend worden; daarna staat hij op goedgekeurd.
 */
export async function signQuote(token: string, name: string, signatureImage: string) {
  const { data: existing, error: lookupError } = await supabase
    .from('quotes')
    .select('id, signed_at')
    .eq('public_token', token)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existing) return null;
  if (existing.signed_at) throw new Error('Deze offerte is al ondertekend');

  const { data, error } = await supabase
    .from('quotes')
    .update({
      signed_at: now(),
      signed_name: name,
      signature_image: signatureImage,
      status: 'approved',
      updated_at: now(),
    })
    .eq('public_token', token)
    .select('id, signed_at, signed_name')
    .single();

  if (error) throw error;
  return data;
}

// Invoices
export async function getInvoices(tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(${CUSTOMER_SUMMARY})
    `)
    .eq('tenant_id', tenantId)
    // Concepten (nog zonder nummer) bovenaan, daarna op factuurnummer, nieuwste eerst
    .order('invoice_number', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInvoice(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Factuur niet gevonden');

  const invoice = data as any;

  // De koppeling tussen een factuur en zijn creditfacturen, in beide richtingen
  const [{ data: creditNotes }, { data: original }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('credit_for_invoice_id', invoice.id)
      .eq('tenant_id', tenantId)
      .order('created_at'),
    invoice.credit_for_invoice_id
      ? supabase
          .from('invoices')
          .select('id, invoice_number')
          .eq('id', invoice.credit_for_invoice_id)
          .eq('tenant_id', tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...invoice,
    blocks: await fetchBlocks('invoice', id, tenantId),
    credit_notes: creditNotes || [],
    credit_for: original || null,
  };
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  blocks: DocumentBlock[]
) {
  // Een nieuwe factuur is een concept zonder nummer; dat komt pas bij het
  // vastleggen (zie assignInvoiceNumber)
  const { invoice_number, ...invoiceWithoutNumber } = invoice as any;

  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert({ ...invoiceWithoutNumber, invoice_number: null, updated_at: now() })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  await saveBlocks('invoice', invoiceData.id, invoice.tenant_id, blocks);

  return invoiceData as Invoice;
}

export async function updateInvoice(
  id: string | number,
  tenantId: string,
  updates: Partial<Invoice>,
  blocks?: DocumentBlock[]
) {
  // De betaaldatum volgt de status: op Betaald wordt het vandaag (of blijft
  // de datum van eerder), terug naar iets anders wist hem weer. Zo klopt de
  // omzet, hoe de factuur ook op Betaald komt
  if (updates.status !== undefined && updates.paid_at === undefined) {
    if (updates.status === 'paid') {
      const { data: current } = await supabase
        .from('invoices')
        .select('paid_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      updates = { ...updates, paid_at: current?.paid_at || now() };
    } else {
      updates = { ...updates, paid_at: null };
    }
  }

  // Uit concept betekent vastleggen, en een vastliggende factuur heeft een nummer
  if (updates.status !== undefined && updates.status !== 'draft') {
    await assignInvoiceNumber(id, tenantId);
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  if (Array.isArray(blocks)) {
    await saveBlocks('invoice', id, tenantId, blocks);
  }

  return data as Invoice;
}

export async function deleteInvoice(id: string | number, tenantId: string) {
  // Een verstuurde factuur hoort in de boekhouding en blijft dus bestaan
  const { data: current } = await supabase
    .from('invoices')
    .select('status, invoice_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (current && isFinalInvoice(current)) {
    throw new Error('Een verstuurde factuur kan niet verwijderd worden. Maak een creditfactuur om hem terug te draaien.');
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;

  // Een concept met een nummer (van vóór de nummering bij vastleggen, of een
  // mislukte verzending) geeft dat nummer terug als het het laatste was
  await releaseDocumentNumber(tenantId, 'invoice', current?.invoice_number);
  return { success: true };
}

/** Zet een offerte om in een factuur, inclusief alle regels. */
export async function convertQuoteToInvoice(quoteId: string | number, tenantId: string) {
  const quote = await getQuote(quoteId, tenantId);

  if (quote.converted_to_invoice_id) {
    throw new Error('Deze offerte is al omgezet naar een factuur');
  }

  // Pas een factuur als de klant akkoord is: ondertekend, of door de aannemer
  // zelf op Goedgekeurd gezet na een akkoord per mail of telefoon
  if (quote.status !== 'approved') {
    throw new Error('Deze offerte is nog niet goedgekeurd door de klant');
  }

  // Alle blokken gaan mee, inclusief hun eigen BTW-tarief, zodat de
  // splitsing tussen bijvoorbeeld 9% en 21% op de factuur intact blijft
  const blocks: DocumentBlock[] = copyBlocks(quote.blocks);

  const today = vandaagHier();

  const invoice = await createInvoice(
    {
      tenant_id: tenantId,
      customer_id: quote.customer_id,
      invoice_date: today,
      due_date: dagenErbij(today, 30),
      total: calculateDocumentTotal(blocks),
      status: 'draft',
      currency: quote.currency,
      intro_text: quote.intro_text,
      notes: quote.notes,
      quote_id: typeof quoteId === 'number' ? quoteId : parseInt(quoteId as string, 10),
    } as Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
    blocks
  );

  await updateQuote(quoteId, tenantId, { converted_to_invoice_id: invoice.id });

  return invoice;
}

/**
 * Een creditfactuur bij een verstuurde factuur: dezelfde klant en regels, met
 * min-bedragen, als concept. Gaat het om een deel, dan haal je in het concept
 * de regels weg die niet teruggedraaid worden. Hij krijgt een eigen nummer uit
 * dezelfde reeks en verwijst naar de oorspronkelijke factuur.
 */
export async function createCreditNote(invoiceId: string | number, tenantId: string) {
  const invoice = await getInvoice(invoiceId, tenantId);

  if (!isFinalInvoice(invoice)) {
    throw new Error('Een concept kun je nog gewoon aanpassen; een creditfactuur is niet nodig');
  }
  if (isCreditNote(invoice)) {
    throw new Error('Van een creditfactuur kun je geen creditfactuur maken');
  }

  const blocks: DocumentBlock[] = copyBlocks(invoice.blocks).map(block => ({
    ...block,
    elements: block.elements.map(element => ({
      ...element,
      items: element.items.map(item => (item.is_heading ? item : { ...item, price: -Number(item.price) || 0 })),
    })),
  }));

  const today = vandaagHier();

  return createInvoice(
    {
      tenant_id: tenantId,
      customer_id: invoice.customer_id,
      invoice_date: today,
      // Er valt niets te betalen, dus ook niets te laat; anders staat hij op het dashboard bij Verlopen
      due_date: null,
      total: calculateDocumentTotal(blocks),
      status: 'draft',
      currency: invoice.currency,
      intro_text: invoice.intro_text,
      notes: invoice.notes,
      credit_for_invoice_id: invoice.id,
    } as Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
    blocks
  );
}

// Notes
export async function getNotes(tenantId: string, customerId?: number) {
  let query = supabase
    .from('notes')
    .select(`
      *,
      customer:customers(${CUSTOMER_SUMMARY})
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getNote(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      customer:customers(${CUSTOMER_SUMMARY})
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

export async function createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ ...note, updated_at: now() })
    .select()
    .single();

  if (error) throw error;
  return data as Note;
}

export async function updateNote(id: string | number, tenantId: string, updates: Partial<Note>) {
  const { data, error } = await supabase
    .from('notes')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string | number, tenantId: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// ============================================================
// Producten: vaste posten met prijs en eenheid, om in een prijstabel te kiezen
// ============================================================

export type ProductInput = Pick<Product, 'name' | 'unit' | 'price'>;

/** Een product zoals hij binnenkomt: een naam is verplicht, de prijs een getal */
export function validateProduct(body: any): ProductInput | string {
  const name = String(body?.name || '').trim();
  if (!name) return 'Geef het product een naam';
  const price = Number(body?.price);
  if (!Number.isFinite(price) || price < 0) return 'Vul een geldige prijs in';
  const unit = String(body?.unit || '').trim() || null;
  return { name: name.slice(0, 200), unit, price: Math.round(price * 100) / 100 };
}

export async function getProducts(tenantId: string) {
  const { data, error } = await supabase.from('products').select('*').eq('tenant_id', tenantId).order('name');
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(tenantId: string, product: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...product, tenant_id: tenantId })
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string | number, tenantId: string, product: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string | number, tenantId: string) {
  const { error } = await supabase.from('products').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) throw error;
}
