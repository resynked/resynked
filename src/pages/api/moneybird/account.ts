import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  MoneybirdTokenError,
  deleteMoneybirdAccount,
  getMoneybirdAccount,
  getMoneybirdAdministrations,
  saveMoneybirdAccount,
} from '@/lib/moneybird';

/**
 * De Moneybird-koppeling van het bedrijf. GET zegt of hij aan staat (en met
 * welke administratie), POST { apiToken, administrationId? } controleert het
 * token en bewaart het, DELETE haalt hem weg. Het token komt hier nooit meer
 * naar buiten.
 *
 * Horen er meer administraties bij het token en is er nog geen gekozen, dan
 * komt de lijst terug om uit te kiezen, en wordt er nog niets bewaard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ account: await getMoneybirdAccount(tenantId) });
    }

    if (req.method === 'POST') {
      const token = String(req.body?.apiToken || '').trim();
      const chosen = req.body?.administrationId ? String(req.body.administrationId) : null;

      // Eerst proberen, zodat een tikfout meteen opvalt en niet pas bij een factuur
      const administrations = await getMoneybirdAdministrations(token);
      if (administrations.length === 0) {
        return res.status(400).json({ error: 'Er hoort geen administratie bij dit token' });
      }

      const administration = chosen
        ? administrations.find(a => a.id === chosen)
        : administrations.length === 1
          ? administrations[0]
          : null;

      if (!administration) {
        return res.status(200).json({ account: null, administrations });
      }

      await saveMoneybirdAccount(tenantId, token, administration);
      return res.status(200).json({ account: { administration: administration.name } });
    }

    if (req.method === 'DELETE') {
      await deleteMoneybirdAccount(tenantId);
      return res.status(200).json({ account: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof MoneybirdTokenError) return res.status(400).json({ error: error.message });
    console.error('Moneybird-koppeling:', error);
    return res.status(500).json({ error: error.message || 'Er is iets misgegaan' });
  }
}
