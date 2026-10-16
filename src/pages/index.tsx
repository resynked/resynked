import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  Check,
  FileSignature,
  Inbox,
  MessageCircle,
  Package,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import SiteLayout from '@/components/site/SiteLayout';
import { DashboardMock, InboxMock, PaymentMock, QuoteMock, WhatsAppMock } from '@/components/site/ProductMocks';

/** Wat er in het abonnement zit; alleen wat Khance echt kan */
const INCLUDED = [
  'Onbeperkt offertes en facturen',
  'Online laten tekenen en betalen met QR-code',
  'Inbox en agenda van Gmail of Outlook',
  'AI: van mail naar offerte',
  'Offertes via WhatsApp',
  'Eigen sjabloon en huisstijl',
  'Herinneringen en "geopend door de klant"',
  'Tweestapsverificatie',
];

const FEATURES = [
  {
    icon: FileSignature,
    title: 'Offerte laten tekenen',
    text: 'Je klant opent de offerte via een link en tekent met zijn vinger of muis. Je ziet wanneer hij hem opent.',
  },
  {
    icon: QrCode,
    title: 'Sneller betaald',
    text: 'Elke factuur heeft een QR-code voor de bank-app. Met Mollie betaalt je klant direct met iDEAL.',
  },
  {
    icon: Inbox,
    title: 'Je mail en agenda erbij',
    text: 'Gmail of Outlook in Khance: lees, beantwoord en plan zonder te wisselen tussen programma’s.',
  },
  {
    icon: Sparkles,
    title: 'Van mail naar offerte',
    text: 'Een aanvraag in je inbox wordt met één klik een conceptofferte, met prijzen uit je eerdere werk.',
  },
  {
    icon: MessageCircle,
    title: 'Offerte via WhatsApp',
    text: 'Stuur vanaf de bouwplaats een bericht met wat je ziet; de offerte staat klaar als je thuis bent.',
  },
  {
    icon: Package,
    title: 'Je vaste prijzen',
    text: 'Uurloon, m² tegelwerk, voorrijkosten: zet ze één keer neer en kies ze terwijl je typt.',
  },
  {
    icon: BellRing,
    title: 'Vanzelf opvolgen',
    text: 'Nog niet getekend? Khance stuurt na een paar dagen een vriendelijke herinnering namens jou.',
  },
  {
    icon: ShieldCheck,
    title: 'Veilig',
    text: 'Je gegevens staan versleuteld, met tweestapsverificatie en een slot op te veel inlogpogingen.',
  },
];

const FAQ = [
  {
    q: 'Voor wie is Khance?',
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
    a: 'Nee. Khance werkt in de browser op je computer, tablet en telefoon. Vraag een demo aan, dan laten we je alles zien en zetten we je account klaar.',
  },
];

/**
 * De homepage van khance.com: wat Khance is, wat het kan, wat het kost, en
 * een demo aanvragen. Ingelogd? Dan staat er in de kop "Naar dashboard".
 */
export default function Home() {
  return (
    <SiteLayout description="Khance is het offerte- en factuursysteem voor vakmensen. Offertes laten tekenen, facturen met QR-code, je mail en agenda erbij, en AI die aanvragen omzet naar offertes. € 35 per maand.">
      <section className="site-hero">
        <div className="site-container">
          <Link href="/#functies" className="site-pill">
            <Sparkles size={13} /> Nieuw: van mail naar offerte met AI <ArrowRight size={13} />
          </Link>
          <h1>Offertes en facturen voor vakmensen. In minuten klaar.</h1>
          <p className="site-lead">
            Maak een offerte, laat hem online tekenen en krijg sneller betaald. Met je mail, agenda en klanten op
            één plek.
          </p>
          <div className="site-cta">
            <Link href="/demo" className="button">
              Demo aanvragen
            </Link>
            <Link href="/#functies" className="button tertiary">
              Bekijk de functies
            </Link>
          </div>
          <div className="site-hero-visual">
            <DashboardMock />
          </div>
        </div>
      </section>

      <section className="site-trades">
        <div className="site-container">
          <span>Gemaakt voor</span>
          {['Aannemers', 'Schilders', 'Tegelzetters', 'Installateurs', 'Timmerlieden', 'Klusbedrijven'].map((trade) => (
            <strong key={trade}>{trade}</strong>
          ))}
        </div>
      </section>

      <section id="functies" className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Functies</span>
            <h2>Alles wat je nodig hebt, niets wat in de weg zit.</h2>
          </div>
          <div className="site-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="site-grid-cell">
                <Icon size={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="werkwijze" className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Werkwijze</span>
            <h2>Van aanvraag tot betaald, in drie stappen.</h2>
          </div>

          <div className="site-feature">
            <div className="site-feature-text">
              <span className="site-step">01</span>
              <h3>Maak de offerte</h3>
              <p>
                Vanuit een mail met één klik, via WhatsApp vanaf de bouwplaats, of zelf met je vaste producten. Je ziet
                meteen hoe hij op papier komt, in je eigen huisstijl.
              </p>
            </div>
            <InboxMock />
          </div>

          <div className="site-feature reverse">
            <div className="site-feature-text">
              <span className="site-step">02</span>
              <h3>Laat hem online tekenen</h3>
              <p>
                Je klant krijgt een nette mail met een knop. Hij bekijkt de offerte en tekent hem direct; jij ziet wanneer
                hij hem opende, en Khance stuurt zelf een herinnering als het even duurt.
              </p>
            </div>
            <div className="site-feature-visual">
              <QuoteMock />
              <WhatsAppMock />
            </div>
          </div>

          <div className="site-feature">
            <div className="site-feature-text">
              <span className="site-step">03</span>
              <h3>Krijg betaald</h3>
              <p>
                Zet de offerte om naar een factuur en verstuur hem. Je klant scant de QR-code met zijn bank-app of betaalt
                met iDEAL, en het geld staat op je eigen rekening.
              </p>
            </div>
            <PaymentMock />
          </div>
        </div>
      </section>

      <section id="prijzen" className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Prijzen</span>
            <h2>Eén abonnement. Alles erin.</h2>
          </div>
          <div className="site-price">
            <div className="site-price-head">
              <span className="title">Khance</span>
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

      <section id="vragen" className="site-section">
        <div className="site-container site-narrow">
          <div className="site-section-head">
            <span className="site-eyebrow">Vragen</span>
            <h2>Veelgestelde vragen</h2>
          </div>
          <div className="site-faq">
            {FAQ.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="site-closing">
        <div className="site-container">
          <h2>Klaar om tijd te besparen?</h2>
          <p>We laten je in een halfuur zien hoe Khance werkt, met jouw manier van werken.</p>
          <Link href="/demo" className="button">
            Demo aanvragen
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
