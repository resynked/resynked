import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

/**
 * Het wachtwoord wijzigen, in twee stappen zoals bij Instellingen › Privacy:
 *
 * - POST { current_password, check: true } controleert alleen het huidige
 *   wachtwoord, zodat de velden voor het nieuwe pas daarna verschijnen.
 * - POST { current_password, new_password } wijzigt het. Ook dan wordt het
 *   huidige opnieuw gecontroleerd; de eerste stap is niet over te slaan.
 *
 * Zo kan iemand aan een onbewaakte computer het wachtwoord niet veranderen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');
  const checkOnly = req.body?.check === true;

  if (!current) return res.status(400).json({ error: 'Vul je huidige wachtwoord in' });
  if (!checkOnly && next.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Je nieuwe wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn` });
  }

  try {
    const { data: user, error } = await supabaseAdmin.from('users').select('password_hash').eq('id', userId).single();
    if (error || !user) throw error || new Error('Gebruiker niet gevonden');

    if (!(await bcrypt.compare(current, user.password_hash))) {
      return res.status(400).json({ error: 'Je huidige wachtwoord klopt niet' });
    }
    if (checkOnly) return res.status(200).json({ ok: true });

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
