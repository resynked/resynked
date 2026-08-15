import { NextApiRequest, NextApiResponse } from 'next';
import { signQuote } from '@/lib/db';

/** Een handtekening is een tekening op een klein vlak; meer dan dit is het nooit. */
const MAX_SIGNATURE_BYTES = 500 * 1024;

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
};

/**
 * Legt de handtekening van de klant vast. Zonder sessie: de sleutel uit de mail
 * is het bewijs dat deze klant bij deze offerte hoort.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (typeof token !== 'string') {
    return res.status(400).json({ error: 'Ongeldige link' });
  }

  const { name, signature } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Vul uw naam in' });
  }

  if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Zet uw handtekening in het vak' });
  }

  if (signature.length > MAX_SIGNATURE_BYTES) {
    return res.status(400).json({ error: 'De handtekening is te groot' });
  }

  try {
    const signed = await signQuote(token, name.trim().slice(0, 200), signature);

    if (!signed) {
      return res.status(404).json({ error: 'Deze offerte bestaat niet of de link is verlopen' });
    }

    return res.status(200).json({ success: true, signed_at: signed.signed_at });
  } catch (error: any) {
    console.error('API error:', error);

    if (error.message === 'Deze offerte is al ondertekend') {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
