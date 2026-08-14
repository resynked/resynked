import { supabaseAdmin } from './supabase';
import type { Customer, Invoice, Quote, LineItem, Note } from './supabase';
import { calculateTotals } from './utils';

// Use supabaseAdmin for all database operations since we handle auth via NextAuth
const supabase = supabaseAdmin;

// Helper function to get updated_at timestamp
const now = () => new Date().toISOString();

/** Normaliseer binnenkomende regels naar wat er in de database gaat. */
function normalizeItems(items: any[], tenantId: string, parentKey: 'quote_id' | 'invoice_id', parentId: number | string) {
  return items.map((item: any, index: number) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;

    return {
      [parentKey]: parentId,
      tenant_id: tenantId,
      description: (item.description || '').trim(),
      quantity,
      unit: item.unit || 'stuks',
      price,
      total: quantity * price,
      position: index,
    };
  });
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

  const { error: contactPersonsError } = await supabase
    .from('contact_persons')
    .delete()
    .eq('customer_id', id)
    .eq('tenant_id', tenantId);

  if (contactPersonsError) throw contactPersonsError;

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
    .select(`
      *,
      customer:customers(*),
      quote_items(id, description, quantity, unit, price, total, position)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;

  if (data?.quote_items) {
    data.quote_items.sort((a: LineItem, b: LineItem) => (a.position ?? 0) - (b.position ?? 0));
  }

  return data;
}

export async function createQuote(
  quote: Omit<Quote, 'id' | 'created_at' | 'updated_at'>,
  items: any[]
) {
  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .insert({ ...quote, updated_at: now() })
    .select()
    .single();

  if (quoteError) throw quoteError;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(normalizeItems(items, quote.tenant_id, 'quote_id', quoteData.id));

    if (itemsError) throw itemsError;
  }

  return quoteData as Quote;
}

export async function updateQuote(
  id: string | number,
  tenantId: string,
  updates: Partial<Quote>,
  items?: any[]
) {
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  // Regels worden in hun geheel vervangen als ze meegestuurd zijn
  if (Array.isArray(items)) {
    const { error: deleteError } = await supabase
      .from('quote_items')
      .delete()
      .eq('quote_id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) throw deleteError;

    if (items.length > 0) {
      const { error: insertError } = await supabase
        .from('quote_items')
        .insert(normalizeItems(items, tenantId, 'quote_id', id));

      if (insertError) throw insertError;
    }
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
    .select(`
      *,
      customer:customers(*),
      invoice_items(id, description, quantity, unit, price, total, position)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;

  if (data?.invoice_items) {
    data.invoice_items.sort((a: LineItem, b: LineItem) => (a.position ?? 0) - (b.position ?? 0));
  }

  return data;
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  items: any[]
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

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(normalizeItems(items, invoice.tenant_id, 'invoice_id', updatedInvoice.id));

    if (itemsError) throw itemsError;
  }

  return updatedInvoice as Invoice;
}

export async function updateInvoice(
  id: string | number,
  tenantId: string,
  updates: Partial<Invoice>,
  items?: any[]
) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  if (Array.isArray(items)) {
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) throw deleteError;

    if (items.length > 0) {
      const { error: insertError } = await supabase
        .from('invoice_items')
        .insert(normalizeItems(items, tenantId, 'invoice_id', id));

      if (insertError) throw insertError;
    }
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

  const items = (quote.quote_items || []).map((item: LineItem) => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
  }));

  const { total } = calculateTotals(items, quote.tax_percentage, quote.discount_percentage);
  const today = new Date();

  const invoice = await createInvoice(
    {
      tenant_id: tenantId,
      customer_id: quote.customer_id,
      invoice_date: today.toISOString().split('T')[0],
      due_date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total,
      status: 'draft',
      currency: quote.currency,
      tax_percentage: quote.tax_percentage,
      discount_percentage: quote.discount_percentage,
      notes: quote.notes,
      quote_id: typeof quoteId === 'number' ? quoteId : parseInt(quoteId as string, 10),
    } as Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
    items
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
