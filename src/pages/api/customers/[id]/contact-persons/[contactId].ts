import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../auth/[...nextauth]';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const { id: customerId, contactId } = req.query;

  if (typeof customerId !== 'string' || typeof contactId !== 'string') {
    return res.status(400).json({ error: 'Invalid IDs' });
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('contact_persons')
        .delete()
        .eq('id', contactId)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      return res.status(200).json({ message: 'Contact person deleted successfully' });
    } catch (error) {
      console.error('API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { first_name, middle_name, last_name, gender, email, phone } = req.body;

      if (!first_name || !last_name) {
        return res.status(400).json({ error: 'First name and last name are required' });
      }

      const { data, error } = await supabase
        .from('contact_persons')
        .update({
          first_name,
          middle_name: middle_name || null,
          last_name,
          gender: gender || null,
          email: email || null,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
