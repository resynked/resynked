import Link from 'next/link';
import { Check } from 'lucide-react';

/**
 * Secties die op meer dan één pagina van de website staan: het prijsblok
 * (homepage en /prijzen) en de veelgestelde vragen (homepage en /vragen).
 * Zo is de inhoud overal hetzelfde.
 */

/** Wat er in het abonnement zit; alleen wat Synbased echt kan */
const INCLUDED = [
  'Onbeperkt offertes en facturen',
  'Online laten tekenen en betalen met QR-code',
  'Inbox en agenda van Gmail of Outlook',
  'AI: van mail naar offerte',
  'Offertes via WhatsApp',
  'Eigen sjabloon en huisstijl',
  'Herinneringen en "geopend door de klant"',
  'Kosten, bank en btw-aangifte',
  'Jaarcijfers en grootboek',
  'Tweestapsverificatie',
];

export const FAQ = [
  {
    q: 'Voor wie is Synbased?',
    a: 'Voor aannemers en vakmensen: schilders, tegelzetters, installateurs, timmerlieden en klusbedrijven die snel een nette offerte willen maken en sneller betaald willen worden.',
  },
  {
    q: 'Kan ik mijn eigen huisstijl gebruiken?',
    a: 'Ja. Je zet je logo en bedrijfsgegevens erin, kiest staand of liggend A4, en wie wil, krijgt een volledig eigen sjabloon voor offertes en facturen.',
  },
  {
    q: 'Gaan mails vanuit mijn eigen adres?',
    a: 'Ja. Je koppelt je eigen Gmail of Outlook; offertes en facturen gaan vanaf je eigen adres en staan ook in je Verzonden. Antwoorden komen gewoon in je eigen inbox.',
  },
  {
    q: 'Hoe betaalt mijn klant?',
    a: 'Met de QR-code op de factuur, met zijn eigen bank-app, of met iDEAL als je Mollie koppelt. Het geld gaat altijd rechtstreeks naar jouw rekening.',
  },
  {
    q: 'Moet ik zelf iets installeren?',
    a: 'Nee. Synbased werkt in de browser op je computer, tablet en telefoon. Vraag een demo aan, dan laten we je alles zien en zetten we je account klaar.',
  },
];

/** Vragen die alleen op /vragen staan, over de boekhouding en veiligheid */
export const MORE_FAQ = [
  {
    q: 'Heb ik nog een boekhoudpakket nodig?',
    a: 'Synbased houdt je kosten, bank, btw-aangifte en jaarcijfers zelf bij. Voor je jaarafsluiting en aangifte inkomstenbelasting exporteer je het grootboek voor je boekhouder.',
  },
  {
    q: 'Klopt de btw-aangifte?',
    a: 'Synbased rekent hem rubriek voor rubriek uit je facturen en kosten, zoals in Mijn Belastingdienst Zakelijk. Bij btw verlegd of buitenland laat je hem nakijken door je boekhouder.',
  },
  {
    q: 'Is de bankkoppeling veilig?',
    a: 'Synbased kan alleen lezen, nooit geld overmaken. Je geeft bij je eigen bank toestemming voor 90 dagen, via GoCardless onder PSD2-vergunning. Liever niet koppelen? Dan importeer je een afschrift.',
  },
  {
    q: 'Hoe lang worden mijn bonnetjes bewaard?',
    a: 'Zolang je ze niet zelf verwijdert, afgeschermd opgeslagen. De Belastingdienst vraagt zeven jaar bewaren; dat kan dus gewoon in Synbased.',
  },
  {
    q: 'Hoe zeg ik op?',
    a: 'Met een mail aan info@synbased.com. Je gegevens kun je meenemen; zie de algemene voorwaarden.',
  },
];

/** Het prijsblok: één abonnement, met wat erin zit */
export function PricingSection({ title = 'Eén abonnement. Alles erin.' }: { title?: string }) {
  return (
    <section className="site-section">
      <div className="site-container">
        <div className="site-section-head">
          <span className="site-eyebrow">Prijzen</span>
          <h2>{title}</h2>
        </div>
        <div className="site-price">
          <div className="site-price-head">
            <span className="title">Synbased</span>
            <div className="amount">
              <strong>€ 35</strong>
              <span>per maand, excl. btw</span>
            </div>
            <Link href="/demo" className="button">
              Demo aanvragen
            </Link>
          </div>
          <ul>
            {INCLUDED.map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** De veelgestelde vragen als uitklapbare lijst */
export function FaqSection({ items = FAQ, title = 'Veelgestelde vragen' }: { items?: { q: string; a: string }[]; title?: string }) {
  return (
    <section className="site-section">
      <div className="site-container site-narrow">
        <div className="site-section-head">
          <span className="site-eyebrow">Vragen</span>
          <h2>{title}</h2>
        </div>
        <div className="site-faq">
          {items.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Het zwarte blok onderaan met de demoknop */
export function ClosingSection({ title = 'Klaar om tijd te besparen?' }: { title?: string }) {
  return (
    <section className="site-closing">
      <div className="site-container">
        <h2>{title}</h2>
        <p>We laten je in een halfuur zien hoe Synbased werkt, met jouw manier van werken.</p>
        <Link href="/demo" className="button">
          Demo aanvragen
        </Link>
      </div>
    </section>
  );
}
