import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

/** Het wachtwoord wijzigen: POST { new_password }, voor wie er ingelogd is. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;
  const next = String(req.body?.new_password || '');

  if (next.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Je nieuwe wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn` });
  }

  try {
    // Zelfde manier van opslaan als bij het registreren
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(next, salt);
    const { error: updateError } = await supabaseAdmin.from('users').update({ password_hash: passwordHash }).eq('id', userId);
    if (updateError) throw updateError;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Je wachtwoord kon niet worden gewijzigd' });
  }
}
