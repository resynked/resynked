import { ComponentType } from 'react';
import { CalendarDays, Copy, ExternalLink, Inbox } from 'lucide-react';
import { GoogleIcon, MicrosoftIcon } from '@/components/BrandIcons';
import ToolButton from '@/components/ToolButton';
import { useToast } from '@/components/Toast';
import type { MailProviderName } from '@/lib/mail/types';

/** Alles wat er over een plug-in te vertellen valt, voor de lijst en het venster. */
export interface Plugin {
  provider: MailProviderName;
  name: string;
  icon: ComponentType<{ size?: number }>;
  /** Eén regel in de lijst bij Instellingen */
  summary: string;
  /** Wat het doet, in een paar zinnen */
  about: string;
  capabilities: string;
  links: { website: string; privacy: string; access: string };
}

export const PLUGINS: Plugin[] = [
  {
    provider: 'google',
    name: 'Google',
    icon: GoogleIcon,
    summary: 'Gmail en Google Agenda in Resynked',
    about:
      'Lees en beantwoord je Gmail vanuit je Inbox in Resynked, en zie je afspraken uit Google Agenda. Wat je verstuurt gaat via Gmail zelf, dus het staat daar ook gewoon in Verzonden.',
    capabilities: 'Mail lezen, versturen en ordenen, agenda bekijken',
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
    links: {
      website: 'https://outlook.office.com',
      privacy: 'https://privacy.microsoft.com/nl-nl/privacystatement',
      access: 'https://myapps.microsoft.com',
    },
  },
];

/** Wat een plug-in binnen Resynked aanzet. */
const PARTS = [
  { icon: Inbox, name: 'Inbox', description: 'Je mail lezen, beantwoorden, doorsturen en ordenen' },
  { icon: CalendarDays, name: 'Agenda', description: 'Je afspraken van deze en komende weken bekijken' },
];

interface PluginDetailProps {
  plugin: Plugin;
  /** Er is al een andere dienst gekoppeld, die hiermee vervangen wordt */
  replaces: { name: string; email: string } | null;
  connecting: boolean;
  onConnect: () => void;
  /** De vorige poging liep vast op toestemming van een beheerder */
  adminRequired: boolean;
  config: { googleClientId: string | null; microsoftAdminConsentUrl: string | null } | null;
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
 */
export default function PluginDetail({ plugin, replaces, connecting, onConnect, adminRequired, config }: PluginDetailProps) {
  const toast = useToast();
  const Icon = plugin.icon;

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
        <button type="button" className="button tertiary with-icon" disabled={connecting} onClick={onConnect}>
          <Icon size={16} />
          {connecting ? 'Bezig met inloggen...' : `Inloggen met ${plugin.name}`}
        </button>
      </div>

      <p>
        {plugin.about}
        {replaces && ` Je koppeling met ${replaces.name} (${replaces.email}) wordt hiermee vervangen.`}
      </p>

      <h3>
        Onderdelen <span className="description">{PARTS.length}</span>
      </h3>
      <div className="plugin-parts">
        {PARTS.map(({ icon: PartIcon, name, description }) => (
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
        <ExternalRow label="Toegang beheren" href={plugin.links.access} />
      </dl>

      <p className="field-note">
        Resynked haalt je mail en afspraken steeds rechtstreeks bij {plugin.name} op en bewaart ze niet.
        Alleen de sleutel om toegang te krijgen staat versleuteld bij ons opgeslagen. Je kunt de koppeling
        op elk moment uitzetten hier bij Plug-ins, of de toegang intrekken bij {plugin.name} via Toegang beheren.
      </p>
    </div>
  );
}

