import { ComponentType, Fragment, useState } from 'react';
import { ExternalLink, FileText, MailQuestion } from 'lucide-react';
import { AnthropicIcon, GeminiIcon, OpenAiIcon } from '@/components/BrandIcons';
import type { AiProviderName } from '@/lib/ai/types';

/** Alles wat er over een AI-plug-in te vertellen valt, voor de lijst en het venster. */
export interface AiPlugin {
  provider: AiProviderName;
  name: string;
  icon: ComponentType<{ size?: number }>;
  summary: string;
  /** Waar je een sleutel aanmaakt */
  keysUrl: string;
  links: { website: string; privacy: string };
}

export const AI_PLUGINS: AiPlugin[] = [
  {
    provider: 'anthropic',
    name: 'Anthropic',
    icon: AnthropicIcon,
    summary: 'Claude verwerkt aanvragen tot klant, offerte en antwoord',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    links: { website: 'https://www.anthropic.com', privacy: 'https://www.anthropic.com/legal/privacy' },
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    icon: OpenAiIcon,
    summary: 'ChatGPT verwerkt aanvragen tot klant, offerte en antwoord',
    keysUrl: 'https://platform.openai.com/api-keys',
    links: { website: 'https://openai.com', privacy: 'https://openai.com/policies/privacy-policy' },
  },
  {
    provider: 'gemini',
    name: 'Google Gemini',
    icon: GeminiIcon,
    summary: 'Gemini verwerkt aanvragen tot klant, offerte en antwoord, ook gratis',
    keysUrl: 'https://aistudio.google.com/apikey',
    links: { website: 'https://ai.google.dev', privacy: 'https://policies.google.com/privacy' },
  },
];

/** Wat een AI-plug-in binnen Synbased aanzet. */
const PARTS = [
  {
    icon: FileText,
    name: 'Mail omzetten naar offerte',
    description: 'Klant en offerte klaarzetten uit een aanvraag, met prijzen uit je eerdere offertes',
  },
  {
    icon: MailQuestion,
    name: 'Ontbrekende gegevens opvragen',
    description: 'Een antwoord klaarzetten dat de klant om het adres, de maten en andere details vraagt',
  },
];

interface AiPluginDetailProps {
  plugin: AiPlugin;
  connected: boolean;
  /** Er staat al een andere AI-dienst aan, die hiermee vervangen wordt */
  replaces: string | null;
  saving: boolean;
  onInstall: (apiKey: string) => void;
  onRemove: () => void;
}

/**
 * Het venster bij een AI-plug-in. Je plakt je eigen API-sleutel; die wordt
 * eerst geprobeerd en dan versleuteld bewaard. Het gebruik betaal je zelf,
 * rechtstreeks bij de AI-dienst.
 */
export default function AiPluginDetail({ plugin, connected, replaces, saving, onInstall, onRemove }: AiPluginDetailProps) {
  const [apiKey, setApiKey] = useState('');
  const Icon = plugin.icon;

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
          <button type="button" className="button" disabled={saving || !apiKey.trim()} onClick={() => onInstall(apiKey)}>
            {saving ? 'Controleren...' : 'Installeren'}
          </button>
        )}
      </div>

      <p>
        Zet een aanvraag uit je Inbox met één klik om naar een conceptofferte. De AI leest de mail,
        maakt de klant aan, stelt de regels voor met prijzen uit je eerdere offertes, en zet een
        antwoord klaar als er nog gegevens ontbreken. Jij controleert alles voordat er iets wordt
        aangemaakt.
        {replaces && ` Je koppeling met ${replaces} wordt hiermee vervangen.`}
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

      {!connected && (
        <>
          <h3>API-sleutel</h3>
          <p>
            Maak een sleutel aan op{' '}
            <a href={plugin.keysUrl} target="_blank" rel="noreferrer">
              {new URL(plugin.keysUrl).host}
            </a>{' '}
            en plak hem hieronder.{' '}
            {plugin.provider === 'gemini'
              ? 'Google AI Studio heeft een gratis laag met een limiet per minuut en per dag; daar kun je zonder kosten mee testen. Let op: in de gratis laag mag Google je gegevens gebruiken om hun diensten te verbeteren.'
              : `Het gebruik wordt rechtstreeks bij ${plugin.name} afgerekend; per mail gaat het om een paar cent.`}
          </p>
          <div className="form-section">
            <input
              type="password"
              value={apiKey}
              autoComplete="off"
              placeholder="Vul je API-sleutel in"
              aria-label={`API-sleutel van ${plugin.name}`}
              onChange={(event) => setApiKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && apiKey.trim() && !saving) onInstall(apiKey);
              }}
            />
          </div>
        </>
      )}

      <h3>Informatie</h3>
      <dl className="plugin-info">
        <dt>Mogelijkheden</dt>
        <dd>Mail lezen en een voorstel maken voor klant en offerte</dd>
        <dt>Ontwikkelaar</dt>
        <dd>Synbased</dd>
        <dt>Categorie</dt>
        <dd>AI</dd>
        {[
          ['Website', plugin.links.website],
          ['Privacybeleid', plugin.links.privacy],
          ['API-sleutels beheren', plugin.keysUrl],
        ].map(([label, href]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>
              <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
                <ExternalLink size={15} />
              </a>
            </dd>
          </Fragment>
        ))}
      </dl>

      <p className="field-note">
        Alleen als je zelf op "Omzetten naar offerte" klikt, gaat de tekst van die ene mail naar {plugin.name},
        samen met je eerdere offerteregels voor de prijzen. Synbased bewaart geen mail; je sleutel staat versleuteld
        opgeslagen en kun je hier op elk moment verwijderen of bij {plugin.name} intrekken.
      </p>
    </div>
  );
}
