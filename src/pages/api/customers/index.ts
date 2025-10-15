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
      const {
        name,
        first_name,
        middle_name,
        last_name,
        gender,
        company_name,
        email,
        phone,
        address,
        street_address,
        postal_code,
        city,
        date_of_birth,
        iban,
        kvk,
        btw_number,
        debtor_number,
      } = req.body;

      if (!name && !first_name && !company_name) {
        return res.status(400).json({ error: 'Name, first name, or company name is required' });
      }

      const customer = await createCustomer({
        tenant_id: tenantId,
        name,
        first_name: first_name || null,
        middle_name: middle_name || null,
        last_name: last_name || null,
        gender: gender || null,
        company_name: company_name || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        street_address: street_address || null,
        postal_code: postal_code || null,
        city: city || null,
        date_of_birth: date_of_birth || null,
        iban: iban || null,
        kvk: kvk || null,
        btw_number: btw_number || null,
        debtor_number: debtor_number || null,
      });

      return res.status(201).json(customer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
