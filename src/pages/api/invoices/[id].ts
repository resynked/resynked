import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getInvoice, updateInvoice, deleteInvoice } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    if (req.method === 'GET') {
      const invoice = await getInvoice(id, tenantId);
      return res.status(200).json(invoice);
    }

    if (req.method === 'PUT') {
      const {
        customer_id,
        total,
        status,
        invoice_number,
        invoice_date,
        due_date,
        currency,
        tax_percentage,
        discount_percentage,
        items,
      } = req.body;

      const updates: any = {};
      if (customer_id !== undefined) updates.customer_id = customer_id;
      if (total !== undefined) updates.total = parseFloat(total);
      if (status !== undefined) updates.status = status;
      if (invoice_number !== undefined) updates.invoice_number = invoice_number;
      if (invoice_date !== undefined) updates.invoice_date = invoice_date;
      if (due_date !== undefined) updates.due_date = due_date;
      if (currency !== undefined) updates.currency = currency;
      if (tax_percentage !== undefined) updates.tax_percentage = tax_percentage;
      if (discount_percentage !== undefined) updates.discount_percentage = discount_percentage;

      // Update invoice
      const invoice = await updateInvoice(id, tenantId, updates);

      // Update invoice items if provided
      if (items && Array.isArray(items)) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);

        if (deleteError) throw deleteError;

        // Insert new items
        if (items.length > 0) {
          const itemsWithInvoiceId = items.map((item: any) => ({
            invoice_id: id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
            tenant_id: tenantId,
          }));

          const { error: insertError } = await supabase
            .from('invoice_items')
            .insert(itemsWithInvoiceId);

          if (insertError) throw insertError;
        }
      }

      return res.status(200).json(invoice);
    }

    if (req.method === 'DELETE') {
      await deleteInvoice(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
