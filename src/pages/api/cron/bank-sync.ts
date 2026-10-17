import { NextApiRequest, NextApiResponse } from 'next';
import { linkedTenants, syncBankAccounts } from '@/lib/gocardless';

/**
 * Elke ochtend, aangeroepen door Vercel Cron (zie vercel.json): de nieuwe
 * transacties van elk bedrijf met een bankkoppeling ophalen en waar het kan
 * koppelen aan facturen en kosten.
 *
 * Alleen Vercel mag dit aanroepen: die stuurt CRON_SECRET mee.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let synced = 0;
  let failed = 0;

  for (const tenantId of await linkedTenants()) {
    try {
      await syncBankAccounts(tenantId);
      synced++;
    } catch (error) {
      // Verlopen toestemming of een bank die even niet wil: morgen weer
      console.error(`Bank sync for ${tenantId} failed:`, error);
      failed++;
    }
  }

  return res.status(200).json({ synced, failed });
}
