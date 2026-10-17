import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  FileSignature,
  Inbox,
  MessageCircle,
  Package,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import SiteLayout from '@/components/site/SiteLayout';
import { ClosingSection, FaqSection, PricingSection } from '@/components/site/sections';

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
    text: 'Gmail of Outlook in Synbased: lees, beantwoord en plan zonder te wisselen tussen programma’s.',
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
    text: 'Nog niet getekend? Synbased stuurt na een paar dagen een vriendelijke herinnering namens jou.',
  },
  {
    icon: ShieldCheck,
    title: 'Veilig',
    text: 'Je gegevens staan versleuteld, met tweestapsverificatie en een slot op te veel inlogpogingen.',
  },
];

/**
 * De homepage van synbased.com: wat Synbased is, wat het kan, wat het kost, en
 * een demo aanvragen. Prijzen en vragen staan ook op hun eigen pagina. Ingelogd? Dan staat er in de kop "Naar dashboard".
 */
export default function Home() {
  return (
    <SiteLayout description="Synbased is het offerte- en factuursysteem voor vakmensen. Offertes laten tekenen, facturen met QR-code, je mail en agenda erbij, en AI die aanvragen omzet naar offertes. € 35 per maand.">
      <section className="site-hero">
        <div className="site-container">
          <Link href="/modules/ai" className="site-pill">
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
            <Link href="/modules" className="button tertiary">
              Bekijk de modules
            </Link>
          </div>
          <div className="site-hero-visual">
            <Image
              src="/screens/dashboard.webp"
              alt="Het dashboard van Synbased met openstaande offertes, facturen en de omzet"
              width={1680}
              height={1070}
              sizes="(max-width: 1120px) 100vw, 1080px"
              className="screenshot"
              priority
            />
          </div>
        </div>
      </section>

      <section className="site-section">
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
          <div className="site-cta site-more-modules">
            <Link href="/modules" className="button tertiary">
              Bekijk alle modules
            </Link>
          </div>
        </div>
      </section>

      <section className="site-section">
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
            <div className="site-feature-visual">
              <Image
                src="/screens/inbox.webp"
                alt="De inbox in Synbased met een aanvraag die je omzet naar een offerte"
                width={1200}
                height={602}
                sizes="(max-width: 1000px) 100vw, 640px"
                className="screenshot"
              />
            </div>
          </div>

          <div className="site-feature reverse">
            <div className="site-feature-text">
              <span className="site-step">02</span>
              <h3>Laat hem online tekenen</h3>
              <p>
                Je klant krijgt een nette mail met een knop. Hij bekijkt de offerte en tekent hem direct; jij ziet wanneer
                hij hem opende, en Synbased stuurt zelf een herinnering als het even duurt.
              </p>
            </div>
            <div className="site-feature-visual">
              <Image
                src="/screens/quote.webp"
                alt="Een ondertekende offerte zoals de klant hem ziet"
                width={818}
                height={800}
                sizes="(max-width: 1000px) 100vw, 520px"
                className="screenshot"
              />
              {/* Een offerte maken met één WhatsApp-bericht aan de bot */}
              <div className="whatsapp" aria-hidden="true">
                <div className="title">Synbased</div>
                <p className="own">
                  Familie Verhoef, Voorbeeldlaan 12. Keuken en gang 45 m² oude tegels eruit, vloerverwarming en
                  opnieuw tegelen.
                </p>
                <p>Offerte OFF-118 staat als concept klaar voor Familie Verhoef, € 7.308,40.</p>
              </div>
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
            <div className="site-feature-visual">
              <Image
                src="/screens/payment.webp"
                alt="Het betaalblok op een factuur met een QR-code voor de bank-app"
                width={600}
                height={270}
                sizes="(max-width: 1000px) 100vw, 600px"
                className="screenshot"
              />
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      <FaqSection />

      <ClosingSection />
    </SiteLayout>
  );
}
