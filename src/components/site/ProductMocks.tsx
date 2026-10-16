import { ReactNode, useEffect, useState } from 'react';
import { Archive, FilePlus2, File, Inbox, Mail, OctagonAlert, Reply, Send, Star, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import DashboardContent, { type DashboardInvoice, type DashboardQuote } from '@/components/DashboardContent';
import DocumentPreview from '@/components/DocumentPreview';
import PaymentDetails from '@/components/PaymentDetails';
import MailBody from '@/components/MailBody';
import type { RevenueData } from '@/components/RevenueChart';
import type { DocumentBlock, Tenant } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

/**
 * Productbeelden voor de website. Dit zijn de echte onderdelen van de app
 * (zijbalk, dashboard, offerte, betaalblok) met verzonnen gegevens, zodat ze er
 * precies zo uitzien als Khance zelf en vanzelf meelopen als de app verandert.
 *
 * Nooit echte klanten of bedragen gebruiken: alles hier staat openbaar op
 * de website. Namen, nummers en bedragen zijn verzonnen.
 */

/** Een datum zoveel dagen vanaf vandaag, zodat het voorbeeld nooit verouderd oogt */
const days = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date.toISOString().slice(0, 10);
};

/**
 * Pas in de browser tonen: de datums hangen af van vandaag, en de pagina wordt
 * vooraf opgebouwd. Tot dan staat er een lege ruimte van dezelfde hoogte.
 */
function ClientOnly({ height, children }: { height: number; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <div style={{ height }} />;
}

/** Een venster zoals in de browser, met de drie bolletjes en het adres */
export function AppWindow({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  return (
    <div className={`mock-window${className ? ` ${className}` : ''}`} aria-hidden="true" inert>
      <div className="mock-window-bar">
        <span />
        <span />
        <span />
        <div className="mock-window-url">{url}</div>
      </div>
      <div className="mock-window-body">{children}</div>
    </div>
  );
}

/** De app zoals na het inloggen: de zijbalk met daarnaast de pagina */
function AppScreen({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="layout">
      <Sidebar
        preview={{
          path,
          name: 'Daan Visser',
          email: 'daan@voorbeeld.nl',
          unread: 3,
        }}
      />
      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

const customer = (name: string) => ({
  name,
  first_name: null,
  middle_name: null,
  last_name: null,
  company_name: null,
});

const QUOTES: DashboardQuote[] = [
  {
    id: '1',
    quote_number: 'OFF-118',
    customer: customer('Familie Verhoef'),
    status: 'sent',
    valid_until: days(6),
    total: 7308.4,
  },
  {
    id: '2',
    quote_number: 'OFF-117',
    customer: customer('Van Leeuwen Vastgoed'),
    status: 'sent',
    valid_until: days(11),
    total: 18450,
  },
  {
    id: '3',
    quote_number: 'OFF-116',
    customer: customer('M. de Graaf'),
    status: 'draft',
    valid_until: days(20),
    total: 2950,
  },
  {
    id: '4',
    quote_number: 'OFF-115',
    customer: customer('Stichting Het Anker'),
    status: 'sent',
    valid_until: days(24),
    total: 11240.5,
  },
  {
    id: '5',
    quote_number: 'OFF-114',
    customer: customer('Familie Meijer'),
    status: 'draft',
    valid_until: days(28),
    total: 4180,
  },
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => ({
    id: `a${i}`,
    quote_number: '',
    customer: null,
    status: 'approved',
    valid_until: days(-30 - i),
    total: 0,
  })),
  ...[0, 1, 2, 3].map(i => ({
    id: `r${i}`,
    quote_number: '',
    customer: null,
    status: 'rejected',
    valid_until: days(-40 - i),
    total: 0,
  })),
];

const INVOICES: DashboardInvoice[] = [
  {
    id: '1',
    invoice_number: 'FAC-087',
    customer: customer('J. Dekker'),
    status: 'sent',
    due_date: days(9),
    total: 2480,
  },
  {
    id: '2',
    invoice_number: 'FAC-086',
    customer: customer('Familie Mulder'),
    status: 'sent',
    due_date: days(12),
    total: 5615.25,
  },
  {
    id: '3',
    invoice_number: 'FAC-085',
    customer: customer('Van Leeuwen Vastgoed'),
    status: 'sent',
    due_date: days(4),
    total: 3990,
  },
  {
    id: '4',
    invoice_number: 'FAC-088',
    customer: customer('Stichting Het Anker'),
    status: 'draft',
    due_date: days(30),
    total: 1350,
  },
];

/** Omzet per dag van deze maand: verzonnen, een rustige golf die langzaam oploopt */
function revenue(): RevenueData[] {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => ({
    date: new Date(today.getFullYear(), today.getMonth(), i + 1).toLocaleDateString('nl-NL', {
      month: 'short',
      day: 'numeric',
    }),
    revenue: Math.round(1800 + i * 45 + 900 * Math.sin(i / 2.6)),
    unrealized: Math.round(900 + 450 * Math.sin(i / 3.4 + 1.5)),
  }));
}

/** Het echte dashboard, met de zijbalk */
export function DashboardMock() {
  return (
    <AppWindow url="khance.com/dashboard">
      <ClientOnly height={760}>
        <AppScreen path="/dashboard">
          <DashboardContent quotes={QUOTES} invoices={INVOICES} isLoading={false} revenue={revenue()} />
        </AppScreen>
      </ClientOnly>
    </AppWindow>
  );
}

/** Het bedrijf achter de voorbeeldofferte; de rest van de instellingen staat uit */
const TENANT = {
  company_name: 'Klusbedrijf Voorbeeld',
  street_address: 'Voorbeeldstraat 1',
  postal_code: '1234 AB',
  city: 'Voorbeeld',
  email: 'info@voorbeeld.nl',
  phone: '',
  kvk: '',
  btw_number: '',
  iban: 'NL91ABNA0417164300',
  logo_url: null,
  quote_template_html: null,
  invoice_template_html: null,
  paper_orientation: 'portrait',
} as unknown as Tenant;

const line = (description: string, quantity: number, unit: string, price: number) => ({
  description,
  is_heading: false,
  quantity,
  unit,
  price,
});

const QUOTE_BLOCKS: DocumentBlock[] = [
  {
    title: 'Offerte',
    elements: [
      {
        kind: 'gegevens',
        body: null,
        tax_percentage: 21,
        discount_percentage: 0,
        show_quantity: false,
        items: [],
      },
      {
        kind: 'tekst',
        body: '<p>Beste familie Verhoef,</p><p>Hartelijk dank voor uw aanvraag. Hieronder vindt u onze offerte voor het vernieuwen van de vloer in de keuken en de gang.</p>',
        tax_percentage: 21,
        discount_percentage: 0,
        show_quantity: false,
        items: [],
      },
      {
        kind: 'prijstabel',
        body: null,
        tax_percentage: 21,
        discount_percentage: 0,
        show_quantity: true,
        items: [
          line('Verwijderen bestaande vloer', 1, 'post', 1300),
          line('Plaatsen vloerverwarming', 45, 'm²', 72),
          line('Tegelen keuken en gang', 1, 'post', 1500),
        ],
      },
      {
        kind: 'handtekening',
        body: null,
        tax_percentage: 21,
        discount_percentage: 0,
        show_quantity: false,
        items: [],
      },
    ],
  },
];

/** Een handtekening als plaatje, zoals de klant hem met zijn vinger zet */
const SIGNATURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 50"><path d="M5,35 C20,8 30,40 45,22 C55,10 60,36 72,26 C85,14 95,32 110,20 C120,12 135,28 155,14" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>',
  );

/** De offerte zoals de klant hem via zijn link ziet, net ondertekend */
export function QuoteMock() {
  return (
    // Het document schaalt zichzelf al naar de breedte, dus niet nog eens verkleinen
    <AppWindow url="khance.com/public/quotes/…" className="actual-size">
      <ClientOnly height={560}>
        <div className="public-document">
          <div className="block">
            <DocumentPreview
              title="Offerte"
              meta={[
                { label: 'Offertenummer', value: 'OFF-118' },
                { label: 'Offertedatum', value: formatDate(days(-2)) },
                { label: 'Geldig tot', value: formatDate(days(28)) },
              ]}
              customer={{
                first_name: 'Familie',
                last_name: 'Verhoef',
                street_address: 'Voorbeeldlaan 12',
                postal_code: '1234 CD',
                city: 'Voorbeeld',
              }}
              blocks={QUOTE_BLOCKS}
              tenant={TENANT}
              signature={{
                image: SIGNATURE,
                name: 'L. Verhoef',
                signedAt: days(0),
              }}
            />
          </div>
        </div>
      </ClientOnly>
    </AppWindow>
  );
}

/** Het betaalblok van een factuur, met een echte QR-code voor de bank-app */
export function PaymentMock() {
  return (
    <AppWindow url="khance.com/public/invoices/…" className="actual-size">
      <ClientOnly height={220}>
        <div className="public-document">
          <div className="block">
            <PaymentDetails
              payment={{
                name: 'Klusbedrijf Voorbeeld',
                iban: 'NL91ABNA0417164300',
                amount: 2480,
                reference: 'Factuur FAC-087',
              }}
              dueDate={days(14)}
            />
          </div>
        </div>
      </ClientOnly>
    </AppWindow>
  );
}

const MAILS = [
  {
    from: 'Familie Verhoef',
    initials: 'FV',
    subject: 'Nieuwe vloer keuken en gang',
    snippet: 'Goedemiddag, wij willen graag een nieuwe vloer…',
    time: '10:24',
    unread: true,
    active: true,
  },
  {
    from: 'Van Leeuwen Vastgoed',
    initials: 'VL',
    subject: 'Planning onderhoud voorjaar',
    snippet: 'Kunnen we volgende week de planning doornemen?',
    time: '09:12',
    unread: true,
  },
  {
    from: 'M. de Graaf',
    initials: 'MG',
    subject: 'Re: Offerte OFF-116',
    snippet: 'Dank voor de offerte, ik heb nog één vraag over…',
    time: 'gisteren',
  },
  {
    from: 'Stichting Het Anker',
    initials: 'HA',
    subject: 'Schilderwerk kozijnen',
    snippet: 'Zou u ook naar de achterzijde kunnen kijken?',
    time: 'gisteren',
  },
  {
    from: 'J. Dekker',
    initials: 'JD',
    subject: 'Betaling factuur',
    snippet: 'De factuur is vandaag overgemaakt. Groet, Jan',
    time: 'ma',
  },
];

const FOLDERS = [
  { icon: Inbox, name: 'Inbox', count: 3, active: true },
  { icon: Star, name: 'Met ster' },
  { icon: Send, name: 'Verzonden' },
  { icon: File, name: 'Concepten' },
  { icon: Archive, name: 'Archief' },
  { icon: OctagonAlert, name: 'Spam' },
  { icon: Trash2, name: 'Prullenbak' },
];

const MAIL_HTML =
  '<p>Goedemiddag,</p><p>Wij willen graag een nieuwe vloer in de keuken en de gang, ongeveer 45 m², met vloerverwarming. De oude tegels moeten eruit. Kunt u hiervoor een offerte sturen?</p><p>Met vriendelijke groet,<br>Familie Verhoef</p>';

/**
 * De inbox, met dezelfde opbouw en klassen als de echte pagina. De knop om de
 * mail om te zetten naar een offerte is uitgelicht.
 */
export function InboxMock() {
  return (
    <AppWindow url="khance.com/inbox">
      {/* Ook de mail zelf pas in de browser: anders is het kader al geladen
          voordat het zijn hoogte kan meten */}
      <ClientOnly height={520}>
        <div className="inbox">
          <nav className="inbox-folders">
            <span className="section-title">Mappen</span>
            {FOLDERS.map(({ icon: Icon, name, count, active }) => (
              <button key={name} type="button" className={active ? 'active' : ''}>
                <Icon size={15} />
                <span className="name">{name}</span>
                {count && <span className="count">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="inbox-list">
            <div className="list-header">
              <div className="title-row">
                <h1>Inbox</h1>
              </div>
            </div>
            {MAILS.map(mail => (
              <div
                key={mail.subject}
                className={`inbox-item${mail.active ? ' active' : ''}${mail.unread ? ' unread' : ''}`}
              >
                <span className="pick">
                  {mail.unread && <span className="dot" />}
                  <span className="avatar">{mail.initials}</span>
                </span>
                <span className="summary">
                  <span className="top">
                    <span className="from">{mail.from}</span>
                    <span className="meta">{mail.time}</span>
                  </span>
                  <span className="subject">{mail.subject}</span>
                  <span className="snippet">{mail.snippet}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="inbox-detail">
            <div className="thread">
              <div className="thread-header">
                <h2>Nieuwe vloer keuken en gang</h2>
                <span className="message-actions">
                  <button type="button" className="highlight" data-label="Omzetten naar offerte">
                    <FilePlus2 size={15} />
                  </button>
                  <button type="button">
                    <Archive size={15} />
                  </button>
                  <button type="button">
                    <Mail size={15} />
                  </button>
                  <button type="button" className="delete">
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
              <div className="message">
                <div className="message-header">
                  <span className="avatar">FV</span>
                  <span className="sender">
                    <span className="from">Familie Verhoef</span>
                    <span className="meta">verhoef@voorbeeld.nl</span>
                  </span>
                  <span className="message-actions">
                    <span className="meta">10:24</span>
                    <button type="button">
                      <Reply size={15} />
                    </button>
                  </span>
                </div>
                <MailBody html={MAIL_HTML} />
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    </AppWindow>
  );
}

/** Een offerte maken met één WhatsApp-bericht aan de bot */
export function WhatsAppMock() {
  return (
    <div className="mock-phone" aria-hidden="true">
      <div className="mock-phone-head">Khance</div>
      <div className="mock-bubble own">
        Familie Verhoef, Voorbeeldlaan 12. Keuken en gang 45 m² oude tegels eruit, vloerverwarming en opnieuw tegelen.
      </div>
      <div className="mock-bubble">
        Offerte OFF-118 staat als concept klaar voor Familie Verhoef, € 7.308,40. Bekijk en verstuur hem in Khance.
      </div>
    </div>
  );
}
