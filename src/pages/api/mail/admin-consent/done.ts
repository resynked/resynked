import { NextApiRequest, NextApiResponse } from 'next';
import { escapeHtml } from '@/lib/mail/utils';

/**
 * Waar de IT-beheerder na het geven van toestemming terechtkomt. Hij heeft
 * geen account bij Resynked, dus dit is een losse bevestiging en geen pagina
 * uit de app.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const granted = req.query.admin_consent === 'True' && !req.query.error;
  const title = granted ? 'Toestemming gegeven' : 'Geen toestemming gegeven';
  const text = granted
    ? 'Iedereen in je organisatie kan Resynked nu koppelen aan Outlook. Je kunt dit venster sluiten.'
    : escapeHtml(String(req.query.error_description || 'De toestemming is niet gegeven. Probeer het opnieuw of neem contact op met Resynked.'));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} - Resynked</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;color:#000;background:#fcfcfc}main{max-width:420px;padding:20px;text-align:center}h1{font-size:20px;font-weight:500;margin:0 0 10px}p{color:#7f7f7f;line-height:1.6;margin:0}</style>
</head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`);
}
