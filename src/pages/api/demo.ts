import { NextApiRequest, NextApiResponse } from 'next';
import { buildDemoRequestEmailHtml, isEmailAddress } from '@/lib/email';
import { sendSystemEmail } from '@/lib/system-mail';
import { registerAttempt, type Limit } from '@/lib/rate-limit';

/** Niemand vraagt tien demo's per uur aan; meer is een bot */
const DEMO_LIMIT: Limit = { max: 5, minutes: 60 };

/** Lange teksten afkappen, zodat niemand de mail volstopt */
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

/**
 * Demo aanvragen vanaf de website: POST { name, company, email, phone, message }
 * stuurt een mail naar DEMO_REQUEST_EMAIL. "Beantwoorden" gaat naar de aanvrager.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = {
    name: clean(req.body?.name, 100),
    company: clean(req.body?.company, 100),
    email: clean(req.body?.email, 200).toLowerCase(),
    phone: clean(req.body?.phone, 30),
    message: clean(req.body?.message, 2000),
  };

  if (!request.name) return res.status(400).json({ error: 'Vul je naam in' });
  if (!isEmailAddress(request.email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in' });

  const to = process.env.DEMO_REQUEST_EMAIL;
  if (!to) {
    console.error('Demo-aanvraag: zet DEMO_REQUEST_EMAIL in de omgevingsvariabelen');
    return res.status(500).json({ error: 'De aanvraag kon niet worden verstuurd. Probeer het later opnieuw.' });
  }

  try {
    // Per bezoeker, zodat een bot het formulier niet kan blijven insturen
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (await registerAttempt(`demo:${ip}`, DEMO_LIMIT)) {
      return res.status(429).json({ error: 'Je hebt al een aanvraag gestuurd. We nemen snel contact met je op.' });
    }

    await sendSystemEmail({
      to,
      subject: `Demo-aanvraag: ${request.company || request.name}`,
      html: buildDemoRequestEmailHtml(request),
      replyTo: request.email,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Demo request error:', error);
    return res.status(500).json({ error: 'De aanvraag kon niet worden verstuurd. Probeer het later opnieuw.' });
  }
}
