import { NextApiRequest, NextApiResponse } from 'next';
import { claimMessage, isVerifyToken, sendText, verifySignature } from '@/lib/whatsapp';
import { handleMessage, type IncomingMessage } from '@/lib/whatsapp/bot';

export const config = {
  // De handtekening van Meta gaat over de ruwe inhoud; die mag Next.js niet eerst omzetten
  api: { bodyParser: false },
  // De AI leest het bericht en zet de offerte klaar; dat kan even duren
  maxDuration: 120,
};

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/**
 * De webhook die Meta aanroept voor de WhatsApp-bot van Khance.
 *
 * GET: Meta controleert bij het instellen of deze link van ons is, met het
 * verify token uit WHATSAPP_VERIFY_TOKEN. Daarvoor is de rest van de
 * instellingen nog niet nodig.
 * POST: binnengekomen berichten, getekend met het app-geheim. Statusmeldingen
 * (verzonden, gelezen) slaan we over, en elk bericht wordt hooguit één keer
 * verwerkt, ook als Meta het opnieuw stuurt.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && isVerifyToken(token)) {
      return res.status(200).send(String(challenge));
    }
    console.warn('WhatsApp-webhook: verify token klopt niet met WHATSAPP_VERIFY_TOKEN');
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const body = await rawBody(req);
  if (!verifySignature(body, req.headers['x-hub-signature-256'] as string | undefined)) {
    console.warn('WhatsApp-webhook: handtekening klopt niet; controleer WHATSAPP_APP_SECRET');
    return res.status(401).end();
  }

  let payload: any;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  const values = (payload?.entry || [])
    .flatMap((entry: any) => entry.changes || [])
    .filter((change: any) => change.field === 'messages')
    .map((change: any) => change.value || {});

  // Hoe het met een antwoord van de bot afliep: verzonden, afgeleverd, gelezen of mislukt. Een antwoord
  // dat Meta niet kon afleveren, zoals naar een nummer dat bij een testnummer niet in de lijst met
  // ontvangers staat, komt alleen hier terug
  values
    .flatMap((value: any) => value.statuses || [])
    .forEach((status: any) =>
      status.status === 'failed'
        ? console.warn('WhatsApp-bericht niet afgeleverd aan', status.recipient_id, status.errors)
        : console.info(`WhatsApp-bericht ${status.status} bij`, status.recipient_id)
    );

  const messages: IncomingMessage[] = values
    .flatMap((value: any) => value.messages || [])
    .map((message: any) => ({
      id: String(message.id),
      from: String(message.from).replace(/\D/g, ''),
      type: String(message.type),
      text: message.type === 'text' ? String(message.text?.body ?? '') : null,
    }));

  for (const message of messages) {
    console.info(`WhatsApp: ${message.type}bericht binnen van`, message.from);
    if (!(await claimMessage(message.id))) continue;

    try {
      await handleMessage(message);
    } catch (error) {
      console.error('WhatsApp-bericht verwerken:', error);
      // Het bericht is al geclaimd en komt niet terug; laat de gebruiker weten dat het mislukte
      await sendText(message.from, 'Er ging iets mis bij het maken van je offerte. Probeer het zo nog eens.').catch(() => {});
    }
  }

  // Altijd 200 zodra de handtekening klopt; anders blijft Meta het opnieuw proberen
  return res.status(200).end();
}
