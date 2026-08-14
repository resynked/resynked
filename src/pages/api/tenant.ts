import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getTenant, updateTenant } from '@/lib/db';

// Velden die de aannemer zelf mag aanpassen
const EDITABLE_FIELDS = [
  'company_name',
  'street_address',
  'postal_code',
  'city',
  'email',
  'phone',
  'kvk',
  'btw_number',
  'iban',
  'logo_url',
  'quote_conditions',
  'terms_and_conditions',
  'quote_template_html',
  'invoice_template_html',
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const tenant = await getTenant(tenantId);
      return res.status(200).json(tenant);
    }

    if (req.method === 'PUT') {
      const updates: Record<string, unknown> = {};

      for (const field of EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field] || null;
        }
      }

      const tenant = await updateTenant(tenantId, updates);
      return res.status(200).json(tenant);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
