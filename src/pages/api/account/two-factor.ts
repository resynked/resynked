import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';
import { decrypt, encrypt } from '@/lib/crypto';
import { generateBackupCodes, generateSecret, hashBackupCode, otpauthUrl, verifyCode } from '@/lib/totp';

/**
 * Tweestapsverificatie aan- en uitzetten, met POST { action }:
 *
 * - setup: een nieuwe sleutel met de QR-code om te scannen. Telt pas als hij
 *   met enable is bevestigd.
 * - enable { code }: bevestigt met een code uit de app dat het scannen gelukt
 *   is, en geeft eenmalig de back-upcodes.
 * - disable { password }: zet het uit.
 * - backup-codes { password }: tien nieuwe back-upcodes; de oude vervallen.
 *
 * Uitzetten en nieuwe codes vragen het wachtwoord, zodat iemand aan een
 * onbewaakte computer de beveiliging niet zomaar kan weghalen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id;
  const action = req.body?.action;

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('email, password_hash, totp_secret, totp_enabled_at')
      .eq('id', userId)
      .single();
    if (error || !user) throw error || new Error('Gebruiker niet gevonden');

    const update = (values: Record<string, unknown>) => supabaseAdmin.from('users').update(values).eq('id', userId);

    const checkPassword = async () =>
      bcrypt.compare(String(req.body?.password || ''), user.password_hash);

    if (action === 'setup') {
      if (user.totp_enabled_at) return res.status(409).json({ error: 'Tweestapsverificatie staat al aan' });

      const secret = generateSecret();
      const { error: saveError } = await update({ totp_secret: encrypt(secret), totp_last_counter: null });
      if (saveError) throw saveError;

      const qr = await QRCode.toDataURL(otpauthUrl(secret, user.email), { margin: 1, width: 360 });
      return res.status(200).json({ qr, secret });
    }

    if (action === 'enable') {
      if (user.totp_enabled_at) return res.status(409).json({ error: 'Tweestapsverificatie staat al aan' });
      if (!user.totp_secret) return res.status(400).json({ error: 'Begin opnieuw met aanzetten' });

      const counter = verifyCode(decrypt(user.totp_secret), String(req.body?.code || ''));
      if (counter === null) return res.status(400).json({ error: 'Deze code klopt niet. Probeer de code die nu in de app staat' });

      const backupCodes = generateBackupCodes();
      const { error: saveError } = await update({
        totp_enabled_at: new Date().toISOString(),
        totp_last_counter: counter,
        totp_backup_codes: backupCodes.map(hashBackupCode),
      });
      if (saveError) throw saveError;

      return res.status(200).json({ backupCodes });
    }

    if (action === 'disable') {
      if (!(await checkPassword())) return res.status(400).json({ error: 'Je wachtwoord klopt niet' });

      const { error: saveError } = await update({
        totp_secret: null,
        totp_enabled_at: null,
        totp_last_counter: null,
        totp_backup_codes: null,
      });
      if (saveError) throw saveError;

      return res.status(200).json({ ok: true });
    }

    if (action === 'backup-codes') {
      if (!user.totp_enabled_at) return res.status(400).json({ error: 'Tweestapsverificatie staat uit' });
      if (!(await checkPassword())) return res.status(400).json({ error: 'Je wachtwoord klopt niet' });

      const backupCodes = generateBackupCodes();
      const { error: saveError } = await update({ totp_backup_codes: backupCodes.map(hashBackupCode) });
      if (saveError) throw saveError;

      return res.status(200).json({ backupCodes });
    }

    return res.status(400).json({ error: 'Onbekende actie' });
  } catch (error) {
    console.error('Two-factor error:', error);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw' });
  }
}
