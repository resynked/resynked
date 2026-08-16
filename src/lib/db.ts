import { supabaseAdmin } from './supabase';
import type { Customer, DocumentBlock, Invoice, Quote, Tenant, Note } from './supabase';
import { calculateDocumentTotal, lineTotal } from './utils';
import { copyBlocks } from './blocks';
import { isCountable, nextNumber } from './numbering';

// Use supabaseAdmin for all database operations since we handle auth via NextAuth
const supabase = supabaseAdmin;

// Helper function to get updated_at timestamp
const now = () => new Date().toISOString();

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

const ELEMENT_COLUMNS = 'id, kind, body, tax_percentage, discount_percentage, position';
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
    .order('customer_number', { ascending: true, nullsFirst: false })
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
export async function getQuotes(tenantId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      customer:customers(${CUSTOMER_SUMMARY})
    `)
    .eq('tenant_id', tenantId)
    // Op offertenummer, nieuwste bovenaan
    .order('quote_number', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

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
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
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
        'signed_at, signed_name, signature_image, ' +
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
    // Op factuurnummer, nieuwste bovenaan
    .order('invoice_number', { ascending: false, nullsFirst: false })
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

  return { ...(data as any), blocks: await fetchBlocks('invoice', id, tenantId) };
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  blocks: DocumentBlock[]
) {
  // Heeft de aannemer een eigen nummering, dan komt het nummer daaruit. Zo niet,
  // dan wordt het uit het id afgeleid en moet de rij er dus eerst zijn.
  const { invoice_number, ...invoiceWithoutNumber } = invoice as any;
  const eigenNummer = invoice_number || (await takeDocumentNumber(invoice.tenant_id, 'invoice'));

  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert({ ...invoiceWithoutNumber, invoice_number: eigenNummer || null, updated_at: now() })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  if (eigenNummer) return invoiceData as Invoice;

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({ invoice_number: `FT${invoiceData.id + 10000}` })
    .eq('id', invoiceData.id)
    .select()
    .single();

  if (updateError) throw updateError;

  await saveBlocks('invoice', updatedInvoice.id, invoice.tenant_id, blocks);

  return updatedInvoice as Invoice;
}

export async function updateInvoice(
  id: string | number,
  tenantId: string,
  updates: Partial<Invoice>,
  blocks?: DocumentBlock[]
) {
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
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

/** Zet een offerte om in een factuur, inclusief alle regels. */
export async function convertQuoteToInvoice(quoteId: string | number, tenantId: string) {
  const quote = await getQuote(quoteId, tenantId);

  if (quote.converted_to_invoice_id) {
    throw new Error('Deze offerte is al omgezet naar een factuur');
  }

  // Alle blokken gaan mee, inclusief hun eigen BTW-tarief, zodat de
  // splitsing tussen bijvoorbeeld 9% en 21% op de factuur intact blijft
  const blocks: DocumentBlock[] = copyBlocks(quote.blocks);

  const today = new Date();

  const invoice = await createInvoice(
    {
      tenant_id: tenantId,
      customer_id: quote.customer_id,
      invoice_date: today.toISOString().split('T')[0],
      due_date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total: calculateDocumentTotal(blocks),
      status: 'draft',
      currency: quote.currency,
      intro_text: quote.intro_text,
      notes: quote.notes,
      quote_id: typeof quoteId === 'number' ? quoteId : parseInt(quoteId as string, 10),
    } as Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
    blocks
  );

  await updateQuote(quoteId, tenantId, {
    status: 'approved',
    converted_to_invoice_id: invoice.id,
  });

  return invoice;
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
