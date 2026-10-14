import { ComponentType } from 'react';
import Link from 'next/link';
import { CalendarDays, Copy, ExternalLink, FileText, Inbox, UserCheck } from 'lucide-react';
import { GoogleIcon, MicrosoftIcon, WhatsAppIcon } from '@/components/BrandIcons';
import ToolButton from '@/components/ToolButton';
import { useToast } from '@/components/Toast';
import type { MailProviderName } from '@/lib/mail/types';
import type { WhatsAppAccountInfo, WhatsAppConfig } from '@/lib/whatsapp/types';

export type PluginProvider = MailProviderName | 'whatsapp';

/** Wat een plug-in binnen Resynked aanzet. */
interface PluginPart {
  icon: ComponentType<{ size?: number }>;
  name: string;
  description: string;
}

const MAIL_PARTS: PluginPart[] = [
  { icon: Inbox, name: 'Inbox', description: 'Je mail lezen, beantwoorden, doorsturen en ordenen' },
  { icon: CalendarDays, name: 'Agenda', description: 'Je afspraken van deze en komende weken bekijken' },
];

/** Alles wat er over een plug-in te vertellen valt, voor de lijst en het venster. */
export interface Plugin<P extends PluginProvider = PluginProvider> {
  provider: P;
  name: string;
  icon: ComponentType<{ size?: number }>;
  /** Eén regel in de lijst bij Instellingen */
  summary: string;
  /** Wat het doet, in een paar zinnen */
  about: string;
  capabilities: string;
  parts: PluginPart[];
  /** Toegang beheren bij de dienst zelf, als die dat kent */
  links: { website: string; privacy: string; access?: string };
}

export const PLUGINS: Plugin<MailProviderName>[] = [
  {
    provider: 'google',
    name: 'Google',
    icon: GoogleIcon,
    summary: 'Gmail en Google Agenda in Resynked',
    about:
      'Lees en beantwoord je Gmail vanuit je Inbox in Resynked, en zie je afspraken uit Google Agenda. Wat je verstuurt gaat via Gmail zelf, dus het staat daar ook gewoon in Verzonden.',
    capabilities: 'Mail lezen, versturen en ordenen, agenda bekijken',
    parts: MAIL_PARTS,
    links: {
      website: 'https://mail.google.com',
      privacy: 'https://policies.google.com/privacy',
      access: 'https://myaccount.google.com/permissions',
    },
  },
  {
    provider: 'microsoft',
    name: 'Microsoft',
    icon: MicrosoftIcon,
    summary: 'Outlook-mail en -agenda in Resynked',
    about:
      'Lees en beantwoord je Outlook-mail vanuit je Inbox in Resynked, en zie je afspraken uit je Outlook-agenda. Werkt met Microsoft 365 voor bedrijven en met Outlook.com. Wat je verstuurt staat ook gewoon in Outlook in Verzonden.',
    capabilities: 'Mail lezen, versturen en ordenen, agenda bekijken',
    parts: MAIL_PARTS,
    links: {
      website: 'https://outlook.office.com',
      privacy: 'https://privacy.microsoft.com/nl-nl/privacystatement',
      access: 'https://myapps.microsoft.com',
    },
  },
];

/**
 * WhatsApp staat los van de mailbox: een eigen nummer per gebruiker, dat
 * naast Google of Microsoft gekoppeld kan zijn.
 */
export const WHATSAPP_PLUGIN: Plugin<'whatsapp'> = {
  provider: 'whatsapp',
  name: 'WhatsApp',
  icon: WhatsAppIcon,
  summary: 'Offertes maken met een WhatsApp-bericht',
  about:
    'Sta je bij een klant te meten? Stuur de Resynked-bot een WhatsApp-bericht met wat er moet gebeuren, zoals "keuken 25 m² muren schilderen, klant Jan de Vries, Dorpsstraat 1 Utrecht". Staat de klant al in Resynked, dan wordt die gebruikt; anders komt er een nieuwe klant bij. De offerte staat daarna als concept klaar, en je krijgt een berichtje terug met het nummer en een link.',
  capabilities: 'Berichten lezen, klanten zoeken en aanmaken, conceptoffertes aanmaken',
  parts: [
    {
      icon: FileText,
      name: 'Offerte via WhatsApp',
      description: 'Stuur wat je bij de klant opmeet, en krijg een conceptofferte met link terug',
    },
    {
      icon: UserCheck,
      name: 'Klant herkennen',
      description: 'Een bestaande klant op e-mail, telefoon of naam; anders een nieuwe klant',
    },
  ],
  links: {
    website: 'https://www.whatsapp.com',
    privacy: 'https://www.whatsapp.com/legal/privacy-policy-eea',
  },
};

interface PluginDetailProps {
  plugin: Plugin;
  /** Er is al een andere dienst gekoppeld, die hiermee vervangen wordt */
  replaces: { name: string; email: string } | null;
  /** Deze dienst is nu gekoppeld; dan staat er Verwijderen in plaats van Installeren */
  connected: boolean;
  connecting: boolean;
  onConnect: () => void;
  onRemove: () => void;
  /** De vorige poging liep vast op toestemming van een beheerder */
  adminRequired: boolean;
  config: { googleClientId: string | null; microsoftAdminConsentUrl: string | null } | null;
  /** Alleen bij WhatsApp: het gekoppelde nummer of de openstaande code, en of er een AI-plug-in aan staat */
  whatsapp?: { account: WhatsAppAccountInfo | null; config: WhatsAppConfig; hasAi: boolean };
}

function ExternalRow({ label, href }: { label: string; href: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
          <ExternalLink size={15} />
        </a>
      </dd>
    </>
  );
}

/**
 * Het venster bij een plug-in: wat het is, wat het aanzet en wat er bij
 * goedkeuring komt kijken, met rechtsboven de knop om te koppelen.
 *
 * Bij WhatsApp staat er in plaats van de goedkeuring hoe je je nummer koppelt:
 * Installeren geeft een code die je vanaf je telefoon naar de bot stuurt.
 */
export default function PluginDetail({
  plugin,
  replaces,
  connected,
  connecting,
  onConnect,
  onRemove,
  adminRequired,
  config,
  whatsapp,
}: PluginDetailProps) {
  const toast = useToast();
  const Icon = plugin.icon;
  const linking = whatsapp?.account && !whatsapp.account.phone ? whatsapp.account.linking : null;

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Gekopieerd', `${what} staat op je klembord`);
    } catch {
      toast.error('Kopiëren mislukt', value);
    }
  };

  return (
    <div className="plugin-detail">
      <span className="plugin-icon large">
        <Icon size={40} />
      </span>

      <div className="plugin-detail-title">
        <div>
          <h2>{plugin.name}</h2>
          <span className="description">Door Resynked</span>
        </div>
        {connected ? (
          <button type="button" className="button negative" onClick={onRemove}>
            Verwijderen
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={connecting || (whatsapp && !whatsapp.config.configured)}
            onClick={onConnect}
          >
            {connecting ? 'Bezig...' : linking ? 'Nieuwe code' : 'Installeren'}
          </button>
        )}
      </div>

      <p>
        {plugin.about}
        {replaces && ` Je koppeling met ${replaces.name} (${replaces.email}) wordt hiermee vervangen.`}
      </p>

      <h3>
        Onderdelen <span className="description">{plugin.parts.length}</span>
      </h3>
      <div className="plugin-parts">
        {plugin.parts.map(({ icon: PartIcon, name, description }) => (
          <div key={name} className="plugin">
            <span className="plugin-icon">
              <PartIcon size={18} />
            </span>
            <span className="information">
              <span className="title">{name}</span>
              <span className="description">{description}</span>
            </span>
          </div>
        ))}
      </div>

      {whatsapp ? (
        <>
          <h3>Koppelen</h3>
          <div
            className={`plugin-approval${
              linking || !whatsapp.config.configured || (!whatsapp.hasAi && !whatsapp.account?.phone) ? ' highlight' : ''
            }`}
          >
            {!whatsapp.config.configured ? (
              <p>WhatsApp is nog niet ingesteld voor Resynked. Vraag de beheerder van Resynked om de bot aan te zetten.</p>
            ) : whatsapp.account?.phone ? (
              <p>
                Berichten van <strong>{whatsapp.account?.phone}</strong> worden offertes in jouw account. Sla de bot op
                in je telefoon als <strong>Resynked</strong>, met nummer {whatsapp.config.botNumber}. Stuur hem{' '}
                <strong>help</strong> voor een voorbeeld.
              </p>
            ) : linking ? (
              <>
                <p>
                  Open WhatsApp op je telefoon en stuur dit bericht naar <strong>{whatsapp.config.botNumber}</strong>.
                  Zit je op je telefoon, open het dan meteen in WhatsApp; het bericht staat dan al klaar.
                </p>
                <div className="copy-field">
                  <code>{linking.message}</code>
                  <ToolButton title="Bericht kopiëren" onClick={() => copy(linking.message, 'Het bericht')}>
                    <Copy size={15} />
                  </ToolButton>
                  <ToolButton title="Openen in WhatsApp" onClick={() => window.open(linking.link, '_blank', 'noreferrer')}>
                    <ExternalLink size={15} />
                  </ToolButton>
                </div>
                <p className="field-note">
                  Wachten op je bericht... De code is een kwartier geldig. Dit venster ziet vanzelf wanneer het gelukt is.
                </p>
              </>
            ) : (
              <p>
                Na <strong>Installeren</strong> krijg je een code. Die stuur je vanaf je eigen telefoon naar de bot;
                daarmee weet Resynked dat het nummer van jou is.
              </p>
            )}
            {whatsapp.config.configured && !whatsapp.hasAi && (
              <p className="field-note">
                De bot gebruikt je AI-plug-in om je bericht te lezen. Zet daarom ook een AI-plug-in aan, bij{' '}
                <strong>AI</strong> in de lijst met plug-ins.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <h3>Goedkeuring</h3>
          <div className={`plugin-approval${adminRequired ? ' highlight' : ''}`}>
            {plugin.provider === 'microsoft' ? (
              <>
                <p>
                  Met een werk- of schoolaccount kan je organisatie eisen dat een IT-beheerder Resynked
                  eerst goedkeurt. Je ziet dan bij het inloggen <strong>Goedkeuring van beheerder nodig</strong>.
                </p>
                <p>
                  Stuur je beheerder deze link. Met één klik geeft hij Resynked toestemming voor iedereen in
                  je organisatie; daarna kun je hier gewoon inloggen.
                </p>
                {config?.microsoftAdminConsentUrl && (
                  <div className="copy-field">
                    <code>{config.microsoftAdminConsentUrl}</code>
                    <ToolButton title="Link kopiëren" onClick={() => copy(config.microsoftAdminConsentUrl!, 'De link')}>
                      <Copy size={15} />
                    </ToolButton>
                  </div>
                )}
                <p className="field-note">Met een persoonlijk Outlook.com-adres is dit niet nodig.</p>
              </>
            ) : (
              <>
                <p>
                  Google laat je bij het inloggen kiezen welke toegang je Resynked geeft. Vink alles aan,
                  anders werken je Inbox of Agenda niet volledig. Toon Google de melding{' '}
                  <strong>Google heeft deze app niet geverifieerd</strong>, kies dan <strong>Geavanceerd</strong> en{' '}
                  <strong>Doorgaan naar Resynked</strong>.
                </p>
                <p>
                  Werk je met Google Workspace? Dan kan je beheerder Resynked vooraf vertrouwen via
                  Admin console › Beveiliging › Toegang en gegevensbeheer › API-beheer › App-toegang
                  beheren, met deze Client-ID:
                </p>
                {config?.googleClientId && (
                  <div className="copy-field">
                    <code>{config.googleClientId}</code>
                    <ToolButton title="Client-ID kopiëren" onClick={() => copy(config.googleClientId!, 'De Client-ID')}>
                      <Copy size={15} />
                    </ToolButton>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <h3>Informatie</h3>
      <dl className="plugin-info">
        <dt>Mogelijkheden</dt>
        <dd>{plugin.capabilities}</dd>
        <dt>Ontwikkelaar</dt>
        <dd>Resynked</dd>
        <dt>Categorie</dt>
        <dd>Communicatie</dd>
        <ExternalRow label="Website" href={plugin.links.website} />
        <ExternalRow label="Privacybeleid" href={plugin.links.privacy} />
        {plugin.links.access && <ExternalRow label="Toegang beheren" href={plugin.links.access} />}
      </dl>

      {whatsapp ? (
        <p className="field-note">
          Wat je de bot stuurt, gaat samen met je eerdere offerteregels naar je AI-plug-in om de offerte te maken.
          Resynked bewaart je berichten niet; alleen een bericht waar nog een klant bij ontbreekt, blijft een uur staan
          tot je het aanvult. De offerte zelf controleer en verstuur je altijd in Resynked;{' '}
          <Link href="/quotes">bij Offertes</Link> staat hij als concept.
        </p>
      ) : (
        <p className="field-note">
          Resynked haalt je mail en afspraken steeds rechtstreeks bij {plugin.name} op en bewaart ze niet.
          Alleen de sleutel om toegang te krijgen staat versleuteld bij ons opgeslagen. Je kunt de koppeling
          op elk moment uitzetten hier bij Plug-ins, of de toegang intrekken bij {plugin.name} via Toegang beheren.
        </p>
      )}
    </div>
  );
}

