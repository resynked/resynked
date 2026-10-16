/**
 * Het standaardsjabloon voor offertes en facturen, in de huisstijl van Khance:
 * zwart-wit, Inter, dunne grijze lijnen, A4. Staand of liggend kiest het bedrijf
 * bij Instellingen > Sjabloon; het papier krijgt dan de class "landscape" en
 * dit sjabloon past zich daaraan aan, op het scherm, op papier en in de PDF. Wie bij Instellingen >
 * Sjabloon niets eigens invult, krijgt dit.
 *
 * Het werkt zoals elk eigen sjabloon (zie de uitleg bij Instellingen): één
 * pagina per blok met data-repeat, de inhoud in data-slot="blok", en losse
 * waarden als {{bedrijf_naam}}. Alle stijlen staan onder .khance-page, want
 * een sjabloon geldt voor de hele pagina.
 *
 * De voettekst staat in de ondermarge van het vel. Die marge telt niet mee
 * als ruimte voor de inhoud, dus de inhoud loopt er nooit overheen. Bij een
 * factuur is die marge groter: daar komt op het laatste vel het betaalblok met
 * de QR-code.
 */

const styles = (invoice: boolean) => `
<style>
/* Elk vel is één pagina, op het formaat dat het bedrijf heeft gekozen */
@page khance-portrait {size: A4 portrait; margin: 0;}
@page khance-landscape {size: A4 landscape; margin: 0;}

.khance-page {
  --sheet-width: 210mm;
  --sheet-height: 297mm;
  page: khance-portrait;
  break-after: page;
  position: relative;
  padding: 16mm 18mm ${invoice ? '70mm' : '30mm'};
  background: #fff;
  color: #000;
  font-family: "Inter", Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  line-height: 1.6;
}
.landscape .khance-page {
  --sheet-width: 297mm;
  --sheet-height: 210mm;
  page: khance-landscape;
  padding: 12mm 18mm ${invoice ? '60mm' : '26mm'};
}
.khance-page:last-of-type {break-after: auto;}

/* Kop: logo links, bedrijf rechts */
.khance-page .khance-header {display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; padding: 0 0 7mm 0; margin: 0 0 8mm 0; border-bottom: 1px solid #efefef;}
.khance-page .khance-logo {display: block; max-width: 55mm; max-height: 16mm; object-fit: contain;}
.khance-page .khance-logo[src=""] {display: none;}
.khance-page .khance-company {margin-left: auto; text-align: right; font-size: 8.5pt; line-height: 1.5; color: #7f7f7f;}
.khance-page .khance-company strong {display: block; color: #000; font-weight: 600;}

/* De titel van het blok, zoals "Offerte" of "Algemene voorwaarden" */
.khance-page .khance-title {margin: 0 0 7mm 0; font-size: 20pt; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em;}

/* Klant links, nummer en datums rechts */
.khance-page [data-element="gegevens"] {display: flex; justify-content: space-between; gap: 10mm; margin: 0 0 9mm 0;}
.khance-page .customer-details {line-height: 1.5;}
.khance-page .customer-details > div:first-child {font-weight: 600;}
.khance-page .document-meta {display: grid; grid-template-columns: max-content max-content; gap: 1mm 6mm; font-size: 9pt; text-align: right;}
.khance-page .document-meta > div {display: contents;}
.khance-page .document-meta .label {color: #7f7f7f; text-align: left;}

/* Kop en tekst */
.khance-page h2 {margin: 7mm 0 2mm 0; font-size: 12pt; font-weight: 600; line-height: 1.3;}
.khance-page [data-element="kop"] h2 {margin-top: 0;}
.khance-page .rich-text p {margin: 0 0 3mm 0;}

/* Prijstabel */
.khance-page .table-container {border: 0; border-radius: 0; background: none;}
.khance-page .product-table th {padding: 2mm 3mm; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #7f7f7f; background: #fcfcfc; border-bottom: 1px solid #efefef;}
.khance-page .product-table tr td {padding: 2.2mm 3mm; font-size: 9pt; color: #000; border-bottom: 1px solid #efefef;}
.khance-page .product-table th:last-child, .khance-page .product-table td:last-child {text-align: right; white-space: nowrap;}
.khance-page .invoice-total {width: 75mm; margin: 4mm 0 7mm auto;}
.khance-page .invoice-total-row {display: flex; justify-content: space-between; gap: 6mm; padding: 1mm 3mm; color: #7f7f7f;}
.khance-page .invoice-total-row.total-final {margin: 1.5mm 0 0 0; padding-top: 2.5mm; border-top: 1px solid #000; color: #000; font-weight: 600;}

/* Handtekening */
.khance-page .signature-fields {margin: 8mm 0 0 0; font-size: 8.5pt; color: #7f7f7f;}

/* Voettekst in de ondermarge, met alleen wat is ingevuld */
.khance-page .khance-footer {position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display: flex; flex-wrap: wrap; gap: 1mm 6mm; padding: 4mm 0 0 0; border-top: 1px solid #efefef; font-size: 7.5pt; color: #7f7f7f;}
.khance-page .khance-footer span:empty {display: none;}
.khance-page .khance-footer [data-label]::before {content: attr(data-label) " "; color: #000;}
${
  invoice
    ? `
/* Het betaalblok met de QR-code, boven de voettekst, alleen op het laatste vel */
.khance-page .khance-payment {position: absolute; left: 18mm; right: 18mm; bottom: 24mm;}
.khance-page:not(:last-of-type) .khance-payment {display: none;}
.khance-page .payment-details {margin: 0; padding: 4mm; grid-template-columns: 26mm minmax(0, 1fr); gap: 6mm; font-size: 8.5pt;}
.khance-page .payment-details .qr {width: 26mm; height: 26mm;}
.khance-page .payment-details p {margin: 0.5mm 0 2mm 0;}`
    : ''
}
</style>`;

const page = (invoice: boolean) => `
<div class="khance-page" data-repeat="blok">
  <header class="khance-header">
    <img class="khance-logo" src="{{logo}}" alt="{{bedrijf_naam}}">
    <div class="khance-company">
      <strong>{{bedrijf_naam}}</strong>
      <div>{{bedrijf_adres}}</div>
      <div>{{bedrijf_postcode_plaats}}</div>
    </div>
  </header>

  <h1 class="khance-title" data-slot="bloktitel"></h1>
  <div data-slot="blok"></div>
${invoice ? '\n  <div class="khance-payment" data-slot="betaling"></div>\n' : ''}
  <footer class="khance-footer">
    <span>{{bedrijf_email}}</span>
    <span>{{bedrijf_telefoon}}</span>
    <span data-label="KvK">{{bedrijf_kvk}}</span>
    <span data-label="Btw">{{bedrijf_btw}}</span>
    <span data-label="IBAN">{{bedrijf_iban}}</span>
  </footer>
</div>`;

export const DEFAULT_QUOTE_TEMPLATE = (styles(false) + page(false)).trim();
export const DEFAULT_INVOICE_TEMPLATE = (styles(true) + page(true)).trim();

/** Het sjabloon voor een document: het eigen sjabloon van de aannemer, of anders dat van Khance */
export function documentTemplate(title: 'Offerte' | 'Factuur', own?: string | null): string {
  if (own?.trim()) return own;
  return title === 'Offerte' ? DEFAULT_QUOTE_TEMPLATE : DEFAULT_INVOICE_TEMPLATE;
}
