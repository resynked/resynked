import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getCustomer, updateCustomer, deleteCustomer } from '@/lib/db';

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
      const customer = await getCustomer(id, tenantId);
      return res.status(200).json(customer);
    }

    if (req.method === 'PUT') {
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

      const customer = await updateCustomer(id, tenantId, {
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

      return res.status(200).json(customer);
    }

    if (req.method === 'DELETE') {
      await deleteCustomer(id, tenantId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
}
