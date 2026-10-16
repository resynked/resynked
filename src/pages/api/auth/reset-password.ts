import { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { clearAttempts } from '@/lib/rate-limit';

/**
 * Een nieuw wachtwoord met de link uit de mail. POST { token, password }.
 * De link werkt één keer en een uur lang; daarna vervallen ook alle andere
 * links die voor dit account nog openstonden.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const expired = 'Deze link werkt niet meer. Vraag een nieuwe aan.';

  if (!token) return res.status(400).json({ error: expired });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Je nieuwe wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn` });
  }

  try {
    const { data: reset } = await supabaseAdmin
      .from('password_resets')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', createHash('sha256').update(token).digest('hex'))
      .maybeSingle();

    if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: expired });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', reset.user_id)
      .select('email')
      .single();
    if (error) throw error;

    // Deze en alle andere openstaande links van dit account zijn nu op
    await supabaseAdmin
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', reset.user_id)
      .is('used_at', null);

    // Wie net zijn wachtwoord herstelt, mag meteen weer inloggen
    await clearAttempts(`login:${String(user.email).toLowerCase()}`);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Je wachtwoord kon niet worden gewijzigd. Probeer het opnieuw.' });
  }
}
