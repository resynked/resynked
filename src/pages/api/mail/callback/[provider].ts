import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { MAIL_CHANNEL, STATE_COOKIE, isMailProvider, mailProvider, redirectUri, saveMailAccount } from '@/lib/mail';

/**
 * Een klein pagina'tje voor in het popupvenster. Het laat Instellingen weten
 * hoe het ging en sluit zichzelf.
 *
 * Het bericht gaat over een BroadcastChannel én via window.opener: de
 * inlogpagina's van Google en Microsoft verbreken soms de band met het venster
 * dat de popup opende, en dan is opener leeg. Gaat het venster niet dicht
 * (of was het geen popup), dan gaat het zelf terug naar Instellingen.
 */
function finish(res: NextApiResponse, result: { ok: boolean; error?: string; adminRequired?: boolean }) {
  const message = JSON.stringify({ type: 'mail-connected', ...result }).replace(/</g, '\\u003c');
  const fallback = `/settings?tab=plugins${result.ok ? '' : `&mail_error=${encodeURIComponent(result.error || '')}`}`;

  res.setHeader('Set-Cookie', `${STATE_COOKIE}=; Path=/api/mail/callback; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><meta charset="utf-8"><title>Inbox koppelen</title>
<script>
  var data = ${message};
  try { new BroadcastChannel(${JSON.stringify(MAIL_CHANNEL)}).postMessage(data); } catch (e) {}
  try { if (window.opener) window.opener.postMessage(data, window.location.origin); } catch (e) {}
  window.close();
  setTimeout(function () { window.location.replace(${JSON.stringify(fallback)}); }, 500);
</script>`);
}

/** De terugkeer na het inloggen bij Google of Microsoft. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return finish(res, { ok: false, error: 'Je bent niet meer ingelogd' });

  const { provider, code, state, error } = req.query;
  if (!isMailProvider(provider)) return finish(res, { ok: false, error: 'Onbekende mailaanbieder' });

  // De organisatie laat medewerkers zelf geen toestemming geven; dat moet
  // eerst een beheerder doen (Microsoft geeft daar deze foutcodes voor)
  const description = String(req.query.error_description || '');
  if (error && (error === 'consent_required' || /AADSTS(65001|90094|90095)/.test(description))) {
    return finish(res, {
      ok: false,
      adminRequired: true,
      error: 'Je organisatie wil dat een beheerder Khance eerst goedkeurt',
    });
  }

  // Iemand brak het inloggen af, of gaf geen toestemming
  if (error) return finish(res, { ok: false, error: 'Koppelen afgebroken' });

  if (typeof state !== 'string' || !state || state !== req.cookies[STATE_COOKIE]) {
    return finish(res, { ok: false, error: 'Het koppelen is verlopen, probeer het opnieuw' });
  }

  if (typeof code !== 'string') return finish(res, { ok: false, error: 'Geen toegang gekregen' });

  try {
    const mail = mailProvider(provider);
    const tokens = await mail.exchangeCode(code, redirectUri(provider));
    const email = await mail.address(tokens.accessToken);

    const user = session.user as any;
    await saveMailAccount(user.id, user.tenantId, provider, email, tokens);

    return finish(res, { ok: true });
  } catch (err: any) {
    console.error('Inbox koppelen mislukt:', err);
    return finish(res, { ok: false, error: err.message || 'Koppelen mislukt' });
  }
}
