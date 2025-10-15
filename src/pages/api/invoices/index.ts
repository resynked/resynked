import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getInvoices, createInvoice } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const invoices = await getInvoices(tenantId);
      return res.status(200).json(invoices);
    }

    if (req.method === 'POST') {
      const {
        customer_id,
        total,
        status,
        invoice_date,
        due_date,
        currency,
        tax_percentage,
        discount_percentage,
        items,
      } = req.body;

      if (!customer_id || total === undefined) {
        return res.status(400).json({ error: 'Customer ID and total are required' });
      }

      const invoice = await createInvoice(
        {
          tenant_id: tenantId,
          customer_id,
          invoice_date,
          due_date,
          currency: currency || 'EUR',
          tax_percentage: tax_percentage || 21,
          discount_percentage: discount_percentage || 0,
          total: parseFloat(total),
          status: status || 'draft',
        } as any,
        items || []
      );

      return res.status(201).json(invoice);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
