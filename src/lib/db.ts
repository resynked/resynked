import { supabase } from './supabase';
import type { Customer, Product, Invoice, InvoiceItem, Quote, QuoteItem, Order, OrderItem } from './supabase';

// Helper function to get updated_at timestamp
const now = () => new Date().toISOString();

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

export async function getCustomer(id: string, tenantId: string) {
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

export async function updateCustomer(id: string, tenantId: string, updates: Partial<Customer>) {
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

export async function deleteCustomer(id: string, tenantId: string) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// Products
export async function getProducts(tenantId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Product[];
}

export async function getProduct(id: string, tenantId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data as Product;
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...product, updated_at: now() })
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, tenantId: string, updates: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string, tenantId: string) {
  const { error } = await supabase
    .from('products')
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
      customer:customers(id, name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInvoice(id: string, tenantId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(id, name, email),
      invoice_items(
        id,
        quantity,
        price,
        product:products(id, name, description)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  items: any[]
) {
  // Create invoice
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert({ ...invoice, updated_at: now() })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  // Create invoice items
  if (items.length > 0) {
    const itemsWithInvoiceId = items.map((item: any) => ({
      invoice_id: invoiceData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      tenant_id: invoice.tenant_id,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsWithInvoiceId);

    if (itemsError) throw itemsError;
  }

  return invoiceData as Invoice;
}

export async function updateInvoice(id: string, tenantId: string, updates: Partial<Invoice>) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string, tenantId: string) {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// Invoice Items
export async function updateInvoiceItem(id: string, updates: Partial<InvoiceItem>) {
  const { data, error } = await supabase
    .from('invoice_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as InvoiceItem;
}

export async function deleteInvoiceItem(id: string) {
  const { error } = await supabase
    .from('invoice_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

// Quotes
export async function getQuotes(tenantId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      customer:customers(id, name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getQuote(id: string, tenantId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      customer:customers(id, name, email),
      quote_items(
        id,
        quantity,
        price,
        total,
        product:products(id, name, description)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
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
    const itemsWithQuoteId = items.map((item: any) => ({
      quote_id: quoteData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(itemsWithQuoteId);

    if (itemsError) throw itemsError;
  }

  return quoteData as Quote;
}

export async function updateQuote(id: string, tenantId: string, updates: Partial<Quote>) {
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Quote;
}

export async function deleteQuote(id: string, tenantId: string) {
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// Orders
export async function getOrders(tenantId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getOrder(id: string, tenantId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, email),
      order_items(
        id,
        quantity,
        price,
        total,
        product:products(id, name, description)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at'>,
  items: any[]
) {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({ ...order, updated_at: now() })
    .select()
    .single();

  if (orderError) throw orderError;

  if (items.length > 0) {
    const itemsWithOrderId = items.map((item: any) => ({
      order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;
  }

  return orderData as Order;
}

export async function updateOrder(id: string, tenantId: string, updates: Partial<Order>) {
  const { data, error } = await supabase
    .from('orders')
    .update({ ...updates, updated_at: now() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data as Order;
}

export async function deleteOrder(id: string, tenantId: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

// Conversion functions
export async function convertQuoteToOrder(quoteId: string, tenantId: string) {
  // Get quote with items
  const quote = await getQuote(quoteId, tenantId);

  // Generate order number
  const orderNumber = `ORD-${Date.now()}`;

  // Create order from quote
  const order = await createOrder(
    {
      tenant_id: tenantId,
      customer_id: quote.customer_id,
      order_number: orderNumber,
      order_date: new Date().toISOString().split('T')[0],
      total: quote.total,
      status: 'pending',
      currency: quote.currency,
      tax_percentage: quote.tax_percentage,
      discount_percentage: quote.discount_percentage,
      notes: quote.notes,
      quote_id: quoteId,
    },
    quote.quote_items.map((item: any) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.price,
    }))
  );

  // Update quote to mark as converted
  await updateQuote(quoteId, tenantId, {
    status: 'approved',
    converted_to_order_id: order.id,
  });

  return order;
}

export async function convertOrderToInvoice(orderId: string, tenantId: string) {
  // Get order with items
  const order = await getOrder(orderId, tenantId);

  // Generate invoice number
  const invoiceNumber = `INV-${Date.now()}`;

  // Create invoice from order
  const invoice = await createInvoice(
    {
      tenant_id: tenantId,
      customer_id: order.customer_id,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      total: order.total,
      status: 'draft',
      currency: order.currency,
      tax_percentage: order.tax_percentage,
      discount_percentage: order.discount_percentage,
    },
    order.order_items.map((item: any) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.price,
    }))
  );

  // Update order to mark as converted
  await updateOrder(orderId, tenantId, {
    status: 'completed',
    converted_to_invoice_id: invoice.id,
  });

  return invoice;
}
