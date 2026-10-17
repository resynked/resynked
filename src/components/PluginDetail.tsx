import { ComponentType, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Copy, ExternalLink, FileText, Inbox, UserCheck } from 'lucide-react';
import { GoogleIcon, MicrosoftIcon, WhatsAppIcon } from '@/components/BrandIcons';
import ToolButton from '@/components/ToolButton';
import { useToast } from '@/components/Toast';
import type { MailProviderName } from '@/lib/mail/types';
import type { WhatsAppAccountInfo, WhatsAppConfig } from '@/lib/whatsapp/types';

export type PluginProvider = MailProviderName | 'whatsapp';

/** Wat een plug-in binnen Synbased aanzet. */
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
    summary: 'Gmail en Google Agenda in Synbased',
    about:
      'Lees en beantwoord je Gmail vanuit je Inbox in Synbased, en zie je afspraken uit Google Agenda. Wat je verstuurt gaat via Gmail zelf, dus het staat daar ook gewoon in Verzonden.',
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
    summary: 'Outlook-mail en -agenda in Synbased',
    about:
      'Lees en beantwoord je Outlook-mail vanuit je Inbox in Synbased, en zie je afspraken uit je Outlook-agenda. Werkt met Microsoft 365 voor bedrijven en met Outlook.com. Wat je verstuurt staat ook gewoon in Outlook in Verzonden.',
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
 * WhatsApp staat los van de mailbox: de bot van Synbased, met het eigen
 * mobiele nummer van de gebruiker, naast Google of Microsoft.
 */
export const WHATSAPP_PLUGIN: Plugin<'whatsapp'> = {
  provider: 'whatsapp',
  name: 'WhatsApp',
  icon: WhatsAppIcon,
  summary: 'Maak onderweg een offerte met één WhatsApp-bericht aan de Synbased-bot',
  about:
    'Maak een offerte op de plek waar je bent. Stuur vanaf je telefoon een WhatsApp-bericht aan de Synbased-bot met het werk, de aantallen en de klant, en Synbased zet de offerte als concept klaar. Een klant die al in Synbased staat wordt herkend; anders komt er een nieuwe klant bij. Je krijgt meteen een berichtje terug met het offertenummer en een link om hem na te lezen en te versturen.',
  capabilities: 'Berichten lezen en beantwoorden, klanten zoeken en aanmaken, conceptoffertes aanmaken',
  parts: [
    {
      icon: FileText,
      name: 'Offerte via WhatsApp',
      description: 'Een bericht met het werk en de aantallen wordt een conceptofferte, met prijzen uit je eerdere offertes',
    },
    {
      icon: UserCheck,
      name: 'Klant herkennen',
      description: 'Een bestaande klant op e-mail, telefoon of naam; anders een nieuwe klant',
    },
  ],
  links: {
    website: 'https://business.whatsapp.com/products/business-platform',
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
  /** Bij WhatsApp met het ingevulde mobiele nummer */
  onConnect: (phone?: string) => void;
  onRemove: () => void;
  /** De vorige poging liep vast op toestemming van een beheerder */
  adminRequired: boolean;
  config: { googleClientId: string | null; microsoftAdminConsentUrl: string | null } | null;
  /** Alleen bij WhatsApp: het gekoppelde nummer, de bot van Synbased, en of er een AI-plug-in aan staat */
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
 * Bij WhatsApp staan daar de gegevens van de bot, zoals de API-sleutel bij een
 * AI-plug-in, maar vast: Synbased stelt ze voor iedereen in. De gebruiker vult
 * alleen zijn eigen mobiele nummer in.
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
  const [phone, setPhone] = useState('');

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
          <span className="description">Door Synbased</span>
        </div>
        {connected ? (
          <button type="button" className="button negative" onClick={onRemove}>
            Verwijderen
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={connecting || (whatsapp && (!whatsapp.config.configured || !phone.trim()))}
            onClick={() => onConnect(whatsapp ? phone : undefined)}
          >
            {connecting ? 'Bezig...' : 'Installeren'}
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
          <h3>Gegevens van Meta</h3>
          {whatsapp.config.configured ? (
            <p>
              De bot draait op het WhatsApp-nummer van Synbased; die gegevens stellen wij voor iedereen in, je hoeft
              bij Meta niets aan te maken.{' '}
              {whatsapp.account
                ? 'Berichten vanaf je mobiele nummer hieronder worden offertes in jouw account.'
                : 'Vul je eigen mobiele nummer in: alleen berichten vanaf dat nummer worden offertes in jouw account.'}
            </p>
          ) : (
            <div className="plugin-approval highlight">
              <p>WhatsApp is nog niet ingesteld voor Synbased. Zodra de bot aan staat, kun je hem hier installeren.</p>
            </div>
          )}
          {!whatsapp.hasAi && (
            <div className="plugin-approval highlight">
              <p>
                De bot gebruikt je AI-plug-in om je bericht te lezen. Zet daarom ook een AI-plug-in aan, bij{' '}
                <strong>AI</strong> in de lijst met plug-ins.
              </p>
            </div>
          )}
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="whatsapp_bot_number">Nummer van de bot</label>
                <input id="whatsapp_bot_number" type="text" value={whatsapp.config.botNumber || ''} disabled />
              </div>
              <div className="form-group">
                <label htmlFor="whatsapp_token">Toegangstoken</label>
                <input id="whatsapp_token" type="text" value={whatsapp.config.tokenHint || ''} disabled />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="whatsapp_phone">Je eigen mobiele nummer</label>
                <input
                  id="whatsapp_phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Vul je mobiele nummer in"
                  value={whatsapp.account ? whatsapp.account.phone : phone}
                  disabled={!!whatsapp.account || !whatsapp.config.configured}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && phone.trim() && !connecting) onConnect(phone);
                  }}
                />
              </div>
            </div>
            {whatsapp.account && (
              <p className="field-note">
                Sla de bot op in je telefoon als Synbased, met nummer {whatsapp.config.botNumber}, en stuur hem{' '}
                <strong>help</strong> voor een voorbeeld. Ander nummer? Verwijder de koppeling en installeer opnieuw.
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
                  Met een werk- of schoolaccount kan je organisatie eisen dat een IT-beheerder Synbased
                  eerst goedkeurt. Je ziet dan bij het inloggen <strong>Goedkeuring van beheerder nodig</strong>.
                </p>
                <p>
                  Stuur je beheerder deze link. Met één klik geeft hij Synbased toestemming voor iedereen in
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
                  Google laat je bij het inloggen kiezen welke toegang je Synbased geeft. Vink alles aan,
                  anders werken je Inbox of Agenda niet volledig. Toon Google de melding{' '}
                  <strong>Google heeft deze app niet geverifieerd</strong>, kies dan <strong>Geavanceerd</strong> en{' '}
                  <strong>Doorgaan naar Synbased</strong>.
                </p>
                <p>
                  Werk je met Google Workspace? Dan kan je beheerder Synbased vooraf vertrouwen via
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
        <dd>Synbased</dd>
        <dt>Categorie</dt>
        <dd>Communicatie</dd>
        <ExternalRow label="Website" href={plugin.links.website} />
        <ExternalRow label="Privacybeleid" href={plugin.links.privacy} />
        {plugin.links.access && <ExternalRow label="Toegang beheren" href={plugin.links.access} />}
      </dl>

      {whatsapp ? (
        <p className="field-note">
          Wat je de bot stuurt, gaat samen met je eerdere offerteregels naar je AI-plug-in om de offerte te maken.
          Synbased bewaart je berichten niet; alleen een bericht waar nog een klant bij ontbreekt, blijft een uur staan
          tot je het aanvult. Je kunt de koppeling op elk moment hier bij Plug-ins verwijderen. De offerte zelf
          controleer en verstuur je altijd in Synbased; <Link href="/app/quotes">bij Offertes</Link> staat hij als concept.
        </p>
      ) : (
        <p className="field-note">
          Synbased haalt je mail en afspraken steeds rechtstreeks bij {plugin.name} op en bewaart ze niet.
          Alleen de sleutel om toegang te krijgen staat versleuteld bij ons opgeslagen. Je kunt de koppeling
          op elk moment uitzetten hier bij Plug-ins, of de toegang intrekken bij {plugin.name} via Toegang beheren.
        </p>
      )}
    </div>
  );
}

