import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { openMailbox, sendMailError } from '@/lib/mail';

// Een bijlage kan groter zijn dan de standaardgrens voor een antwoord
export const config = {
  api: { responseLimit: false },
};

/**
 * Soorten die de browser veilig zelf kan tonen. Al het andere, zoals HTML of
 * SVG uit een onbekende mail, komt altijd als download: anders zou een
 * bijlage op ons eigen domein scripts kunnen draaien.
 */
const SAFE_TO_SHOW = /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain)$/i;

/**
 * Eén bijlage van een bericht, of een plaatje uit de tekst van de mail.
 * ?download=1 laat hem altijd downloaden in plaats van tonen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { messageId, attachmentId } = req.query;
  if (typeof messageId !== 'string' || typeof attachmentId !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    const { provider, accessToken } = await openMailbox((session.user as any).id);
    const file = await provider.attachment(accessToken, messageId, attachmentId);

    const show = SAFE_TO_SHOW.test(file.mimeType) && req.query.download !== '1';
    const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');

    res.setHeader('Content-Type', show ? file.mimeType : 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${show ? 'inline' : 'attachment'}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
    );
    res.setHeader('Content-Length', file.data.length);
    // Nooit raden naar het soort, en geen scripts. Chrome weigert een pdf met
    // een sandbox te tonen; zijn pdf-viewer draait sowieso los van onze site
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (file.mimeType.toLowerCase() !== 'application/pdf') {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.status(200).send(file.data);
  } catch (error) {
    return sendMailError(res, error);
  }
}
