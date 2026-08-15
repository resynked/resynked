import { Resend } from 'resend';
import type { Customer, Quote, Tenant } from './supabase';
import { getCustomerDisplayName } from './utils';
import { toDisplayHtml } from './richtext';

/**
 * Het adres waarop de app bereikbaar is. De knop in de mail moet een volledige
 * link zijn: een pad alleen werkt niet in een mailprogramma.
 */
export function appUrl(): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!url) throw new Error('Zet APP_URL (of NEXTAUTH_URL) in de omgevingsvariabelen');
  return url.replace(/\/$/, '');
}

/** De pagina waar de klant zijn offerte bekijkt en ondertekent. */
export function quoteLink(token: string): string {
  return `${appUrl()}/offerte/${token}`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

interface QuoteEmailInput {
  tenant: Tenant;
  customer: Customer;
  quote: Pick<Quote, 'quote_number' | 'valid_until'>;
  token: string;
}

/**
 * De mail waarmee een offerte de deur uit gaat: bovenin het logo van de
 * aannemer, daaronder zijn eigen tekst uit Instellingen, en een knop naar de
 * offerte.
 *
 * Het is met de hand geschreven HTML met tabellen en stijlen in de tags zelf.
 * Mailprogramma's — Outlook voorop — doen weinig met moderne opmaak, en een
 * los stylesheet halen ze er sowieso af.
 */
export function buildQuoteEmailHtml({ tenant, customer, quote, token }: QuoteEmailInput): string {
  const link = quoteLink(token);

  // Het logo staat als data-URL in de database, en die blokkeren de meeste
  // mailprogramma's. Daarom wijst de mail naar het adres dat hem uitserveert.
  const logo = tenant.logo_url
    ? `<tr>
        <td style="padding:0 0 24px 0;">
          <img src="${escapeHtml(appUrl())}/api/public/logo/${escapeHtml(tenant.id)}"
               alt="${escapeHtml(tenant.company_name || tenant.name || '')}"
               style="max-width:200px;height:auto;border:0;display:block;">
        </td>
      </tr>`
    : '';

  const intro = tenant.email_intro_text
    ? toDisplayHtml(tenant.email_intro_text)
    : `<p>Beste ${escapeHtml(getCustomerDisplayName(customer))},</p>
       <p>Hierbij ontvangt u onze offerte. U kunt hem hieronder bekijken en direct ondertekenen.</p>`;

  const validUntil = quote.valid_until
    ? `<tr>
        <td style="padding:24px 0 0 0;color:#7f7f7f;font-size:13px;">
          Deze offerte is geldig tot ${escapeHtml(
            new Date(quote.valid_until).toLocaleDateString('nl-NL')
          )}.
        </td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;padding:0;background:#fcfcfc;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcfcfc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #efefef;border-radius:8px;padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">
            ${logo}
            <tr>
              <td>${intro}</td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;">
                <a href="${escapeHtml(link)}"
                   style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 24px;border-radius:6px;">
                  Offerte bekijken en ondertekenen
                </a>
              </td>
            </tr>
            ${validUntil}
            <tr>
              <td style="padding:24px 0 0 0;color:#7f7f7f;font-size:12px;word-break:break-all;">
                Werkt de knop niet? Gebruik dan deze link:<br>
                <a href="${escapeHtml(link)}" style="color:#006bff;">${escapeHtml(link)}</a>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7f7f7f;">
            <tr>
              <td style="padding:16px 32px;">
                ${escapeHtml(tenant.company_name || tenant.name || '')}
                ${tenant.phone ? ` &middot; ${escapeHtml(tenant.phone)}` : ''}
                ${tenant.email ? ` &middot; ${escapeHtml(tenant.email)}` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Het onderwerp: de eigen tekst van de aannemer, of anders een vaste regel. */
export function buildQuoteEmailSubject(tenant: Tenant, quote: Pick<Quote, 'quote_number'>): string {
  return tenant.email_subject?.trim() || `Offerte ${quote.quote_number}`;
}

/** Grof gecontroleerd: één apenstaartje, een punt erachter, en geen witruimte. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value.trim());
}

/**
 * De afzender zoals hij in de mail komt te staan, bijvoorbeeld
 * `Hendrikse Onderhoud <offertes@hendrikse.nl>`.
 *
 * Naam en adres komen uit de instellingen van de aannemer en belanden in een
 * mailkop. Alles wat daar een tweede kop van zou kunnen maken — regeleindes,
 * punthaken, komma's — gaat er daarom uit. Heeft de aannemer geen eigen adres
 * ingevuld, dan valt het terug op het systeemadres uit de omgeving.
 */
export function buildSender(tenant: Pick<Tenant, 'email_from' | 'company_name' | 'name'>): string | null {
  const address = (tenant.email_from || '').trim();

  if (!address || !isEmailAddress(address)) return null;

  const name = (tenant.company_name || tenant.name || '')
    .replace(/[<>,;"\r\n]/g, '')
    .trim();

  return name ? `${name} <${address}>` : address;
}

/**
 * Verstuurt een mail via Resend.
 *
 * De sleutel is systeembreed en staat in de omgeving; het afzendadres komt bij
 * voorkeur uit de instellingen van de aannemer. Het domein van dat adres moet
 * in Resend geverifieerd zijn, anders weigert Resend de mail — daar krijgt de
 * gebruiker hieronder een leesbare melding over in plaats van de kale fout.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  /** Afzender uit de instellingen; leeg betekent het systeemadres */
  from?: string | null;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = options.from || process.env.EMAIL_FROM;

  if (!apiKey) throw new Error('Zet RESEND_API_KEY in de omgevingsvariabelen');

  if (!from) {
    throw new Error(
      'Er is geen afzendadres. Vul er een in bij Instellingen > E-mail, of zet EMAIL_FROM in de omgevingsvariabelen.'
    );
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
  });

  if (error) {
    const message = error.message || 'De mail kon niet verstuurd worden';

    if (/not verified|domain/i.test(message)) {
      throw new Error(
        `Het afzendadres ${from} kan niet gebruikt worden: dat domein is niet geverifieerd in Resend. ` +
          'Verifieer het domein in Resend, of vul bij Instellingen > E-mail een adres in op een domein dat dat wel is.'
      );
    }

    throw new Error(message);
  }

  return data;
}
