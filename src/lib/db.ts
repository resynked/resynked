import { supabaseAdmin } from './supabase';
import type { Customer, DocumentBlock, Invoice, Quote, Tenant, Note } from './supabase';
import { calculateDocumentTotal, lineTotal } from './utils';
import { copyBlocks } from './blocks';

// Use supabaseAdmin for all database operations since we handle auth via NextAuth
const supabase = supabaseAdmin;

// Helper function to get updated_at timestamp
const now = () => new Date().toISOString();

/**
 * Slaat de blokken van een offerte of factuur op. Bestaande blokken gaan er
 * eerst uit; elementen en regels verdwijnen mee door de cascade. Daarna gaan
 * de blokken erin, met hun elementen en de regels van elke prijstabel.
 */
async function saveBlocks(
  soort: 'quote' | 'invoice',
  parentId: number | string,
  tenantId: string,
  blocks: DocumentBlock[]
) {
  const blocksTable = soort === 'quote' ? 'quote_blocks' : 'invoice_blocks';
  const elementsTable = soort === 'quote' ? 'quote_elements' : 'invoice_elements';
  const itemsTable = soort === 'quote' ? 'quote_items' : 'invoice_items';
  const parentKey = soort === 'quote' ? 'quote_id' : 'invoice_id';

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
        body: element.kind === 'tekst' ? element.body || null : null,
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

  if (elementError) throw elementError;

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

/** Zet de genest opgehaalde blokken, elementen en regels op volgorde. */
function sortBlocks(blocks: any[] | null | undefined) {
  if (!blocks) return [];

  const opVolgorde = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);

  return [...blocks].sort(opVolgorde).map((block) => ({
    ...block,
    elements: [...(block.elements || [])].sort(opVolgorde).map((element: any) => ({
      ...element,
      items: [...(element.items || [])].sort(opVolgorde),
    })),
  }));
}

const QUOTE_BLOCK_SELECT =
  'id, title, position, elements:quote_elements(id, kind, body, tax_percentage, discount_percentage, position, items:quote_items(id, description, is_heading, quantity, unit, price, total, position))';

const INVOICE_BLOCK_SELECT =
  'id, title, position, elements:invoice_elements(id, kind, body, tax_percentage, discount_percentage, position, items:invoice_items(id, description, is_heading, quantity, unit, price, total, position))';

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

// Customers
export async function getCustomers(tenantId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
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
      customer:customers(id, name, company_name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getQuote(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(`*, customer:customers(*), blocks:quote_blocks(${QUOTE_BLOCK_SELECT})`)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;

  const quote = data as any;
  return { ...quote, blocks: sortBlocks(quote?.blocks) };
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

// Invoices
export async function getInvoices(tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(id, name, company_name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInvoice(id: string | number, tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`*, customer:customers(*), blocks:invoice_blocks(${INVOICE_BLOCK_SELECT})`)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;

  const invoice = data as any;
  return { ...invoice, blocks: sortBlocks(invoice?.blocks) };
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  blocks: DocumentBlock[]
) {
  // Het factuurnummer wordt uit het id afgeleid, dus eerst invoegen
  const { invoice_number, ...invoiceWithoutNumber } = invoice as any;

  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert({ ...invoiceWithoutNumber, updated_at: now() })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

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
      customer:customers(id, name, company_name)
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
      customer:customers(id, name, company_name, email)
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
