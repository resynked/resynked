import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getCustomers, createCustomer } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const customers = await getCustomers(tenantId);
      return res.status(200).json(customers);
    }

    if (req.method === 'POST') {
      const { name, email, phone, address } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const customer = await createCustomer({
        tenant_id: tenantId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
      });

      return res.status(201).json(customer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
