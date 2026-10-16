import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * De gegevens van wie er ingelogd is. GET geeft naam en e-mailadres, PATCH
 * met { name } past de naam aan. Het e-mailadres is ook de inlognaam en
 * verandert hier niet.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('users').select('name, email').eq('id', userId).single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Vul je naam in' });
      if (name.length > 100) return res.status(400).json({ error: 'Je naam is te lang' });

      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ name })
        .eq('id', userId)
        .select('name, email')
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Account error:', error);
    return res.status(500).json({ error: 'Je gegevens konden niet worden opgeslagen' });
  }
}
