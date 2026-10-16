/**
 * Het standaardsjabloon voor offertes en facturen, in de huisstijl van Khance:
 * zwart-wit, Inter, dunne grijze lijnen. Het formaat (staand of liggend A4)
 * zit niet in het sjabloon maar komt uit de instelling bij Offertes en
 * Facturen; zie .document-paper in globals.css. Wie bij Instellingen >
 * Sjabloon niets eigens invult, krijgt dit.
 *
 * Het werkt zoals elk eigen sjabloon (zie de uitleg bij Instellingen): één
 * pagina per blok met data-repeat, de inhoud in data-slot="blok", en losse
 * waarden als {{bedrijf_naam}}. Alle stijlen staan onder .document-page, want
 * een sjabloon geldt voor de hele pagina.
 *
 * De voettekst staat in de ondermarge van het vel. Die marge telt niet mee
 * als ruimte voor de inhoud, dus de inhoud loopt er nooit overheen. Bij een
 * factuur is die marge groter: daar komt op het laatste vel het betaalblok met
 * de QR-code.
 */

const styles = (invoice: boolean) => `
<style>
/* Het formaat (staand of liggend A4) komt uit de instelling; hier alleen de
   marges, iets kleiner boven en onder als het vel liggend staat */
.document-page {
  position: relative;
  padding: 16mm 18mm ${invoice ? '70mm' : '30mm'};
  background: #fff;
  color: #000;
  font-family: "Inter", Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  line-height: 1.6;
}
.landscape .document-page {padding: 12mm 18mm ${invoice ? '60mm' : '26mm'};}

/* Kop: logo links, bedrijf rechts */
.document-page .document-header {display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; padding: 0 0 7mm 0; margin: 0 0 8mm 0; border-bottom: 1px solid #efefef;}
.document-page .document-logo {display: block; max-width: 55mm; max-height: 16mm; object-fit: contain;}
.document-page .document-logo[src=""] {display: none;}
.document-page .document-company {margin-left: auto; text-align: right; font-size: 8.5pt; line-height: 1.5; color: #7f7f7f;}
.document-page .document-company strong {display: block; color: #000; font-weight: 600;}

/* De titel van het blok, zoals "Offerte" of "Algemene voorwaarden" */
.document-page .document-title {margin: 0 0 7mm 0; font-size: 20pt; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em;}

/* Klant links, nummer en datums rechts */
.document-page [data-element="gegevens"] {display: flex; justify-content: space-between; gap: 10mm; margin: 0 0 9mm 0;}
.document-page .customer-details {line-height: 1.5;}
.document-page .customer-details > div:first-child {font-weight: 600;}
.document-page .document-meta {display: grid; grid-template-columns: max-content max-content; gap: 1mm 6mm; font-size: 9pt; text-align: right;}
.document-page .document-meta > div {display: contents;}
.document-page .document-meta .label {color: #7f7f7f; text-align: left;}

/* Kop en tekst */
.document-page h2 {margin: 7mm 0 2mm 0; font-size: 12pt; font-weight: 600; line-height: 1.3;}
.document-page [data-element="kop"] h2 {margin-top: 0;}

/* Prijstabel */
.document-page .table-container {border: 0; border-radius: 0; background: none;}
.document-page .product-table th {padding: 2mm 3mm; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #7f7f7f; background: #fcfcfc; border-bottom: 1px solid #efefef;}
.document-page .product-table tr td {padding: 2.2mm 3mm; font-size: 9pt; color: #000; border-bottom: 1px solid #efefef;}
.document-page .product-table th:last-child, .document-page .product-table td:last-child {text-align: right; white-space: nowrap;}
.document-page .invoice-total {width: 75mm; margin: 4mm 0 7mm auto;}
.document-page .invoice-total-row {display: flex; justify-content: space-between; gap: 6mm; padding: 1mm 3mm; color: #7f7f7f;}
.document-page .invoice-total-row.total-final {margin: 1.5mm 0 0 0; padding-top: 2.5mm; border-top: 1px solid #000; color: #000; font-weight: 600;}

/* Handtekening */
.document-page .signature-fields {margin: 8mm 0 0 0; font-size: 8.5pt; color: #7f7f7f;}

/* Voettekst in de ondermarge, met alleen wat is ingevuld */
.document-page .document-footer {position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display: flex; flex-wrap: wrap; gap: 1mm 6mm; padding: 4mm 0 0 0; border-top: 1px solid #efefef; font-size: 7.5pt; color: #7f7f7f;}
.document-page .document-footer span:empty {display: none;}
.document-page .document-footer [data-label]::before {content: attr(data-label) " "; color: #000;}
${
  invoice
    ? `
/* Het betaalblok met de QR-code, boven de voettekst, alleen op het laatste vel */
.document-page .document-payment {position: absolute; left: 18mm; right: 18mm; bottom: 24mm;}
.document-page:not(:last-of-type) .document-payment {display: none;}
.document-page .payment-details {margin: 0; padding: 4mm; grid-template-columns: 26mm minmax(0, 1fr); gap: 6mm; font-size: 8.5pt;}
.document-page .payment-details .qr {width: 26mm; height: 26mm;}
.document-page .payment-details p {margin: 0.5mm 0 2mm 0;}`
    : ''
}
</style>`;

const page = (invoice: boolean) => `
<div class="document-page" data-repeat="blok">
  <header class="document-header">
    <img class="document-logo" src="{{logo}}" alt="{{bedrijf_naam}}">
    <div class="document-company">
      <strong>{{bedrijf_naam}}</strong>
      <div>{{bedrijf_adres}}</div>
      <div>{{bedrijf_postcode_plaats}}</div>
    </div>
  </header>

  <h1 class="document-title" data-slot="bloktitel"></h1>
  <div data-slot="blok"></div>
${invoice ? '\n  <div class="document-payment" data-slot="betaling"></div>\n' : ''}
  <footer class="document-footer">
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
