import { NextApiRequest, NextApiResponse } from 'next';
import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { appUrl, buildPasswordResetEmailHtml, isEmailAddress } from '@/lib/email';
import { sendSystemEmail } from '@/lib/system-mail';
import { RESET_LIMIT, registerAttempt } from '@/lib/rate-limit';

/** Zo lang werkt een herstellink */
const VALID_MINUTES = 60;

/**
 * Wachtwoord vergeten: POST { email } stuurt een link om een nieuw wachtwoord
 * te kiezen.
 *
 * Het antwoord is altijd hetzelfde, ook als het adres niet bestaat. Anders kan
 * iemand hiermee uitproberen welke adressen een account hebben.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isEmailAddress(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in' });

  const done = () => res.status(200).json({ ok: true });

  try {
    // Niet eindeloos links laten sturen naar iemands mailbox
    if (await registerAttempt(`reset:${email}`, RESET_LIMIT)) return done();

    // Hoofdletterongevoelig, maar _ en % zijn hier gewone tekens en geen jokers
    const pattern = email.replace(/[\\%_]/g, char => `\\${char}`);
    const { data: user } = await supabaseAdmin.from('users').select('id, name').ilike('email', pattern).maybeSingle();
    if (!user) return done();

    // De sleutel gaat alleen in de mail; hier bewaren we er een hash van
    const token = randomBytes(32).toString('base64url');
    const { error } = await supabaseAdmin.from('password_resets').insert({
      user_id: user.id,
      token_hash: createHash('sha256').update(token).digest('hex'),
      expires_at: new Date(Date.now() + VALID_MINUTES * 60_000).toISOString(),
    });
    if (error) throw error;

    await sendSystemEmail({
      to: email,
      subject: 'Kies een nieuw wachtwoord voor Khance',
      html: buildPasswordResetEmailHtml({
        name: user.name,
        link: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
      }),
    });

    return done();
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'De mail kon niet worden verstuurd. Probeer het later opnieuw.' });
  }
}
