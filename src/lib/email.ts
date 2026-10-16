import type { Customer, Invoice, Quote, Tenant } from './supabase';
import { canRequestPayment, formatIban, invoiceReference } from './payment';
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

/** De pagina waar de klant zijn factuur bekijkt en betaalt. */
export function invoiceLink(token: string): string {
  return `${appUrl()}/factuur/${token}`;
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

/** De tags die in een mailonderwerp gebruikt mogen worden. */
export const SUBJECT_TAGS = {
  quote: ['offertenummer', 'klant', 'bedrijf'],
  invoice: ['factuurnummer', 'klant', 'bedrijf'],
} as const;

/**
 * Vult de tags in een onderwerp, bijvoorbeeld "Offerte {{offertenummer}}".
 * Een tag die niet bestaat blijft staan zoals hij is, zodat een typefout
 * zichtbaar wordt in plaats van stilletjes te verdwijnen.
 */
export function fillSubjectTags(subject: string, values: Record<string, string>): string {
  return subject.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, key) => values[key] ?? match);
}

interface EmailLayout {
  /** Bovenaan de kaart: een logo, of de naam als woordmerk */
  top: string;
  /** De tekst zelf, als HTML */
  content: string;
  /** De zwarte knop, met dezelfde link als reserve eronder */
  button: { label: string; url: string };
  /** Een grijze regel onder de knop, zoals tot wanneer iets geldig is */
  note?: string;
  /** De regel onder de kaart, zoals de naam en het telefoonnummer van het bedrijf */
  footer: string;
}

/**
 * Het frame van elke mail die we versturen: een witte kaart op een lichtgrijze
 * achtergrond, met een zwarte knop en daaronder de link voor als de knop niet
 * werkt. Zo zien de offertemail en de herstelmail er hetzelfde uit.
 *
 * Het is met de hand geschreven HTML met tabellen en stijlen in de tags zelf.
 * Mailprogramma's — Outlook voorop — doen weinig met moderne opmaak, en een
 * los stylesheet halen ze er sowieso af.
 */
export function emailLayout({ top, content, button, note, footer }: EmailLayout): string {
  const noteRow = note
    ? `<tr>
              <td style="padding:24px 0 0 0;color:#7f7f7f;font-size:13px;">${note}</td>
            </tr>`
    : '';

  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;padding:0;background:#fcfcfc;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcfcfc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #efefef;border-radius:8px;padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">
            ${top}
            <tr>
              <td>${content}</td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;">
                <a href="${escapeHtml(button.url)}"
                   style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 24px;border-radius:6px;">
                  ${escapeHtml(button.label)}
                </a>
              </td>
            </tr>
            ${noteRow}
            <tr>
              <td style="padding:24px 0 0 0;color:#7f7f7f;font-size:12px;word-break:break-all;">
                Werkt de knop niet? Gebruik dan deze link:<br>
                <a href="${escapeHtml(button.url)}" style="color:#006bff;">${escapeHtml(button.url)}</a>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7f7f7f;">
            <tr>
              <td style="padding:16px 32px;">${footer}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * De mail waarmee een offerte de deur uit gaat: bovenin het logo van de
 * aannemer, daaronder zijn eigen tekst uit Instellingen, en een knop naar de
 * offerte.
 */
export function buildQuoteEmailHtml({ tenant, customer, quote, token }: QuoteEmailInput): string {
  const intro = tenant.quote_email_intro_text
    ? toDisplayHtml(tenant.quote_email_intro_text)
    : `<p>Beste ${escapeHtml(getCustomerDisplayName(customer))},</p>
       <p>Hierbij ontvangt u onze offerte. U kunt hem hieronder bekijken en direct ondertekenen.</p>`;

  return emailLayout({
    top: tenantLogoRow(tenant),
    content: intro,
    button: { label: 'Offerte bekijken en ondertekenen', url: quoteLink(token) },
    note: validUntilNote(quote),
    footer: tenantFooter(tenant),
  });
}

/**
 * Het logo van de aannemer bovenaan de mail. Het logo staat als data-URL in
 * de database, en die blokkeren de meeste mailprogramma's; daarom wijst de
 * mail naar het adres dat hem uitserveert.
 */
function tenantLogoRow(tenant: Tenant): string {
  if (!tenant.logo_url) return '';
  return `<tr>
        <td style="padding:0 0 24px 0;">
          <img src="${escapeHtml(appUrl())}/api/public/logo/${escapeHtml(tenant.id)}"
               alt="${escapeHtml(tenant.company_name || tenant.name || '')}"
               style="max-width:200px;height:auto;border:0;display:block;">
        </td>
      </tr>`;
}

/** Naam, telefoon en e-mail van de aannemer onder de mail */
function tenantFooter(tenant: Tenant): string {
  return [tenant.company_name || tenant.name || '', tenant.phone || '', tenant.email || '']
    .filter(Boolean)
    .map(escapeHtml)
    .join(' &middot; ');
}

function validUntilNote(quote: Pick<Quote, 'valid_until'>): string | undefined {
  return quote.valid_until
    ? `Deze offerte is geldig tot ${escapeHtml(new Date(quote.valid_until).toLocaleDateString('nl-NL'))}.`
    : undefined;
}

/**
 * De herinnering als een verstuurde offerte na een aantal dagen nog niet is
 * ondertekend. Zelfde opmaak, logo en knop als de offertemail zelf, met een
 * korte, vriendelijke tekst.
 */
export function buildQuoteReminderEmailHtml({ tenant, customer, quote, token }: QuoteEmailInput): string {
  return emailLayout({
    top: tenantLogoRow(tenant),
    content: `<p style="margin:0 0 16px 0;">Beste ${escapeHtml(getCustomerDisplayName(customer))},</p>
       <p style="margin:0 0 16px 0;">Een paar dagen geleden stuurden wij u offerte ${escapeHtml(quote.quote_number || '')}. Heeft u al tijd gehad om ernaar te kijken?</p>
       <p style="margin:0;">Met de knop hieronder bekijkt en ondertekent u hem direct. Heeft u nog vragen, beantwoord dan gerust deze mail.</p>`,
    button: { label: 'Offerte bekijken en ondertekenen', url: quoteLink(token) },
    note: validUntilNote(quote),
    footer: tenantFooter(tenant),
  });
}

/**
 * De mail waarmee een factuur de deur uit gaat: logo, de eigen tekst uit
 * Instellingen, daaronder de betaalgegevens met de QR-code voor de bank-app,
 * en een knop naar de pagina waar de klant de factuur bekijkt en (met Mollie)
 * direct betaalt.
 *
 * De QR-code is een gewone afbeelding van onze eigen server: een data-URL of
 * SVG laten de meeste mailprogramma's niet zien.
 */
export function buildInvoiceEmailHtml({
  tenant,
  customer,
  invoice,
}: {
  tenant: Tenant;
  customer: Customer;
  invoice: Pick<Invoice, 'id' | 'invoice_number' | 'total' | 'due_date' | 'public_token'>;
}): string {
  const token = invoice.public_token || '';
  const reference = invoiceReference(invoice);
  const amount = Number(invoice.total) || 0;
  const amountText = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

  const intro = tenant.invoice_email_intro_text
    ? toDisplayHtml(tenant.invoice_email_intro_text)
    : `<p>Beste ${escapeHtml(getCustomerDisplayName(customer))},</p>
       <p>Hierbij ontvangt u onze factuur van ${escapeHtml(amountText)}. U kunt hem hieronder bekijken en betalen.</p>`;

  const payment = { name: tenant.company_name || tenant.name || '', iban: tenant.iban || '', amount, reference };
  const paymentBlock = canRequestPayment(payment)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0 0;border:1px solid #efefef;border-radius:8px;">
        <tr>
          <td width="120" style="padding:16px;vertical-align:top;">
            <img src="${escapeHtml(appUrl())}/api/public/invoices/${escapeHtml(token)}/qr"
                 alt="QR-code om te betalen" width="120" height="120" style="display:block;border:0;">
          </td>
          <td style="padding:16px 16px 16px 0;vertical-align:top;font-size:13px;line-height:1.6;">
            <strong>Betalen</strong><br>
            <span style="color:#7f7f7f;">Scan de QR-code met uw bank-app, of maak het bedrag over${
              invoice.due_date ? ` vóór ${escapeHtml(new Date(invoice.due_date).toLocaleDateString('nl-NL'))}` : ''
            }.</span><br><br>
            <span style="color:#7f7f7f;">Bedrag</span> ${escapeHtml(amountText)}<br>
            <span style="color:#7f7f7f;">IBAN</span> ${escapeHtml(formatIban(payment.iban))}<br>
            <span style="color:#7f7f7f;">T.n.v.</span> ${escapeHtml(payment.name)}<br>
            <span style="color:#7f7f7f;">Omschrijving</span> ${escapeHtml(reference)}
          </td>
        </tr>
      </table>`
    : '';

  return emailLayout({
    top: tenantLogoRow(tenant),
    content: intro + paymentBlock,
    button: { label: 'Factuur bekijken en betalen', url: invoiceLink(token) },
    footer: tenantFooter(tenant),
  });
}

/**
 * De mail met de link om een nieuw wachtwoord te kiezen. Van Khance zelf, dus
 * met de naam als woordmerk bovenaan in plaats van het logo van een aannemer.
 */
export function buildPasswordResetEmailHtml({ name, link }: { name: string | null; link: string }): string {
  return emailLayout({
    top: `<tr>
        <td style="padding:0 0 24px 0;font-size:20px;font-weight:600;letter-spacing:-0.01em;">Khance</td>
      </tr>`,
    content: `<p style="margin:0 0 16px 0;">${name ? `Hoi ${escapeHtml(name)},` : 'Hoi,'}</p>
       <p style="margin:0;">Je hebt gevraagd om een nieuw wachtwoord voor je Khance-account. Met de knop hieronder kies je er een.</p>`,
    button: { label: 'Nieuw wachtwoord kiezen', url: link },
    note: 'Deze link werkt één keer en is een uur geldig. Heb je dit niet zelf gevraagd? Dan kun je deze mail negeren; je wachtwoord blijft hetzelfde.',
    footer: 'Khance',
  });
}

/**
 * Het onderwerp van de offertemail: de eigen regel van de aannemer met de tags
 * ingevuld, of anders een vaste regel met het offertenummer erin.
 */
export function buildQuoteEmailSubject(
  tenant: Tenant,
  quote: Pick<Quote, 'quote_number'>,
  customer?: Partial<Customer>
): string {
  const eigen = tenant.quote_email_subject?.trim();

  if (!eigen) return `Offerte ${quote.quote_number}`;

  return fillSubjectTags(eigen, {
    offertenummer: quote.quote_number || '',
    klant: customer ? getCustomerDisplayName(customer) : '',
    bedrijf: tenant.company_name || tenant.name || '',
  });
}

/** Hetzelfde voor de factuurmail. */
export function buildInvoiceEmailSubject(
  tenant: Tenant,
  invoice: { invoice_number?: string | null },
  customer?: Partial<Customer>
): string {
  const eigen = tenant.invoice_email_subject?.trim();

  if (!eigen) return `Factuur ${invoice.invoice_number || ''}`.trim();

  return fillSubjectTags(eigen, {
    factuurnummer: invoice.invoice_number || '',
    klant: customer ? getCustomerDisplayName(customer) : '',
    bedrijf: tenant.company_name || tenant.name || '',
  });
}

/** Grof gecontroleerd: één apenstaartje, een punt erachter, en geen witruimte. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value.trim());
}
