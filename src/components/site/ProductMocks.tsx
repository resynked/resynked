import { ReactNode } from 'react';
import { CalendarDays, CircleCheck, FilePen, FileText, Inbox, LayoutDashboard, ReceiptEuro, Sparkles, Users } from 'lucide-react';
import PaymentDetails from '@/components/PaymentDetails';

/**
 * Productbeelden voor de website: nagebouwd in HTML en CSS in plaats van
 * schermafdrukken. Ze blijven scherp op elk scherm, laden snel en lopen mee
 * met de huisstijl. De gegevens zijn verzonnen.
 */

/** Een venster zoals in de browser, met de drie bolletjes en het adres */
export function AppWindow({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="mock-window" aria-hidden="true">
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

const MENU = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Inbox, label: 'Inbox', count: 4 },
  { icon: CalendarDays, label: 'Agenda' },
  { icon: Users, label: 'Klanten' },
  { icon: FileText, label: 'Offertes' },
  { icon: ReceiptEuro, label: 'Facturen' },
  { icon: FilePen, label: 'Notities' },
];

/** Het dashboard: kerncijfers, de omzet als lijn en openstaande offertes */
export function DashboardMock() {
  return (
    <AppWindow url="khance.com/dashboard">
      <div className="mock-app">
        <div className="mock-sidebar">
          {MENU.map(({ icon: Icon, label, active, count }) => (
            <div key={label} className={`mock-menu-item${active ? ' active' : ''}`}>
              <Icon size={14} />
              <span>{label}</span>
              {count && <span className="mock-count">{count}</span>}
            </div>
          ))}
        </div>
        <div className="mock-main">
          <div className="mock-title">Dashboard</div>
          <div className="mock-stats">
            {[
              ['Te ontvangen', '€ 12.480', '6 facturen'],
              ['Openstaande offertes', '€ 48.250', '9 offertes'],
              ['Goedgekeurd', '78%', '18 van 23'],
            ].map(([label, value, note]) => (
              <div key={label} className="mock-card stat">
                <span className="label">{label}</span>
                <span className="value">{value}</span>
                <span className="note">{note}</span>
              </div>
            ))}
          </div>
          <div className="mock-card mock-chart">
            <span className="label">Omzet</span>
            <svg viewBox="0 0 400 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mock-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#006bff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#006bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,90 C40,85 60,60 100,62 C140,64 160,40 200,38 C240,36 260,50 300,30 C340,12 370,18 400,8 L400,110 L0,110 Z" fill="url(#mock-fill)" />
              <path d="M0,90 C40,85 60,60 100,62 C140,64 160,40 200,38 C240,36 260,50 300,30 C340,12 370,18 400,8" fill="none" stroke="#006bff" strokeWidth="2" />
              <path d="M0,100 C60,96 120,80 200,78 C280,76 330,60 400,52" fill="none" stroke="#7f7f7f" strokeWidth="2" strokeDasharray="5 4" />
            </svg>
          </div>
          <div className="mock-card mock-table">
            {[
              ['20260054', 'Rob Adriaens', 'Geopend', '€ 49.781,76'],
              ['20260053', 'Familie Jansen', 'Verzonden', '€ 8.420,00'],
              ['20260052', 'De Boer Vastgoed', 'Concept', '€ 3.150,00'],
            ].map(([nr, name, status, amount]) => (
              <div key={nr} className="mock-row">
                <span>{nr}</span>
                <span>{name}</span>
                <span className="mock-badge">{status}</span>
                <span className="amount">{amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/** Een offerte zoals de klant hem ziet, net ondertekend */
export function QuoteMock() {
  return (
    <div className="mock-paper" aria-hidden="true">
      <div className="mock-paper-head">
        <strong>Offerte</strong>
        <span>20260054</span>
      </div>
      {[
        ['Verwijderen bestaande vloer', '€ 1.300,00'],
        ['Plaatsen vloerverwarming (45 m²)', '€ 3.240,00'],
        ['Tegelen keuken en gang', '€ 1.500,00'],
      ].map(([label, amount]) => (
        <div key={label} className="mock-line">
          <span>{label}</span>
          <span>{amount}</span>
        </div>
      ))}
      <div className="mock-line total">
        <span>Totaal incl. btw</span>
        <span>€ 7.308,40</span>
      </div>
      <div className="mock-signature">
        <svg viewBox="0 0 160 40">
          <path d="M5,30 C20,5 30,35 45,18 C55,8 60,30 72,22 C85,12 95,28 110,16 C120,10 135,24 155,12" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="caption">Handtekening opdrachtgever</span>
      </div>
      <div className="mock-toast">
        <CircleCheck size={14} /> Ondertekend door Rob Adriaens
      </div>
    </div>
  );
}

/** Het betaalblok onder een factuur, met een echte QR-code voor de bank-app */
export function PaymentMock() {
  return (
    <div className="mock-paper mock-payment" aria-hidden="true">
      <div className="mock-paper-head">
        <strong>Factuur</strong>
        <span>2026-0118</span>
      </div>
      <PaymentDetails
        payment={{ name: 'Bouwbedrijf De Vries', iban: 'NL91ABNA0417164300', amount: 2480, reference: 'Factuur 2026-0118' }}
        dueDate="2026-11-14"
      />
    </div>
  );
}

/** De inbox, met een aanvraag die de AI omzet naar een offerte */
export function InboxMock() {
  return (
    <AppWindow url="khance.com/inbox">
      <div className="mock-inbox">
        <div className="mock-mail-list">
          {[
            ['Familie Jansen', 'Badkamer opnieuw betegelen', true],
            ['Gemeente Huizen', 'Planning onderhoud', false],
            ['Rob Adriaens', 'Akkoord offerte', false],
          ].map(([from, subject, active]) => (
            <div key={String(from)} className={`mock-mail${active ? ' active' : ''}`}>
              <strong>{from}</strong>
              <span>{subject}</span>
            </div>
          ))}
        </div>
        <div className="mock-mail-read">
          <strong>Badkamer opnieuw betegelen</strong>
          <p>
            Goedemiddag, wij willen onze badkamer (ca. 8 m²) opnieuw laten betegelen, inclusief het verwijderen van
            de oude tegels. Kunt u een offerte sturen? Groet, Familie Jansen
          </p>
          <div className="mock-ai">
            <Sparkles size={14} />
            Omzetten naar offerte
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/** Een offerte maken met één WhatsApp-bericht aan de bot */
export function WhatsAppMock() {
  return (
    <div className="mock-phone" aria-hidden="true">
      <div className="mock-phone-head">Khance</div>
      <div className="mock-bubble own">
        Familie Jansen, Dorpsstraat 12 Huizen. Badkamer 8 m² tegels eruit en opnieuw tegelen, kitten.
      </div>
      <div className="mock-bubble">
        Offerte 20260056 staat als concept klaar voor Familie Jansen, € 2.950,00. Bekijk en verstuur hem hier:
        khance.com/quotes/…
      </div>
    </div>
  );
}
