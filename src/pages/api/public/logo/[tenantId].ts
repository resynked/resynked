import { NextApiRequest, NextApiResponse } from 'next';
import { getTenant } from '@/lib/db';

/**
 * Serveert het logo van een aannemer als gewone afbeelding.
 *
 * In de database staat het als data-URL, en die blokkeren de meeste
 * mailprogramma's in een <img>. Vandaar dit adres: de mail wijst hierheen en
 * krijgt de afbeelding zelf terug. Een logo is geen geheim, dus hier hoeft
 * niemand voor in te loggen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tenantId } = req.query;

  if (typeof tenantId !== 'string') {
    return res.status(400).json({ error: 'Ongeldig adres' });
  }

  try {
    const tenant = await getTenant(tenantId);
    const dataUrl = tenant?.logo_url;

    const match = dataUrl?.match(/^data:([\w/+.-]+);base64,(.+)$/);

    if (!match) {
      return res.status(404).json({ error: 'Geen logo ingesteld' });
    }

    const [, contentType, base64] = match;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(base64, 'base64'));
  } catch (error) {
    console.error('API error:', error);
    return res.status(404).json({ error: 'Geen logo ingesteld' });
  }
}
