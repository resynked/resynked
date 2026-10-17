import { useEffect, useState } from 'react';
import { Bird, BookCheck, ExternalLink, RefreshCw } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import Select from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';

const TOKENS = 'https://moneybird.com/user/applications/new';

/** Wat Moneybird binnen Synbased aanzet, bovenop het btw-overzicht dat iedereen al heeft */
const PARTS = [
  {
    icon: BookCheck,
    name: 'Facturen in de boekhouding',
    description: 'Elke verstuurde factuur en creditfactuur staat meteen in Moneybird, met de juiste btw',
  },
  {
    icon: RefreshCw,
    name: 'Betalingen mee',
    description: 'Staat een factuur in Synbased op betaald, dan ook in Moneybird',
  },
];

/**
 * Moneybird bij Instellingen > Plug-ins, als groep "Boekhouding" in de lijst
 * van PluginsSettings. Eén koppeling per bedrijf, met het eigen API-token van
 * de aannemer. Opgezet zoals MolliePluginSection.
 *
 * Zonder Moneybird exporteert de aannemer het btw-overzicht voor zijn boekhouder.
 */
export default function MoneybirdPluginSection() {
  const toast = useToast();
  const { confirm } = useConfirm();
  // undefined zolang het laadt, null als er niets gekoppeld is
  const [account, setAccount] = useState<{ administration: string } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [apiToken, setApiToken] = useState('');
  // Horen er meer administraties bij het token, dan kiest de gebruiker er een
  const [administrations, setAdministrations] = useState<{ id: string; name: string }[]>([]);
  const [administrationId, setAdministrationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('/api/moneybird/account')
      .then(res => (res.ok ? res.json() : { account: null }))
      .then(data => setAccount(data.account ?? null))
      .catch(() => setAccount(null));
  }, []);

  const install = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/moneybird/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken, administrationId: administrationId || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Het token kon niet worden opgeslagen');

      if (!data.account) {
        setAdministrations(data.administrations || []);
        return;
      }

      setAccount(data.account);
      setApiToken('');
      setAdministrations([]);
      setAdministrationId('');
      toast.success('Geïnstalleerd', `Nieuwe facturen gaan vanaf nu naar ${data.account.administration}`);
    } catch (error: any) {
      toast.error('Installeren mislukt', error.message);
    } finally {
      setSaving(false);
    }
  };

  /** Facturen van vóór de koppeling, en wat eerder niet lukte, alsnog overzetten */
  const sync = async () => {
    setSyncing(true);
    let total = 0;
    try {
      for (;;) {
        const response = await fetch('/api/moneybird/sync', { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Overzetten mislukt');
        total += data.pushed || 0;
        if (data.error) {
          toast.error('Niet alles overgezet', `${total} overgezet; ${data.error}`);
          return;
        }
        if (!data.more) break;
      }
      toast.success('Overgezet', total ? `${total} factu(u)r(en) staan nu in Moneybird` : 'Alle facturen stonden al in Moneybird');
    } catch (error: any) {
      toast.error('Overzetten mislukt', error.message);
    } finally {
      setSyncing(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Moneybird verwijderen',
      message: 'Je API-token wordt verwijderd en nieuwe facturen gaan niet meer naar Moneybird. Wat er al in staat, blijft daar staan.',
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/api/moneybird/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setAccount(null);
      setOpen(false);
      toast.success('Verwijderd', 'Moneybird is ontkoppeld');
    } catch {
      toast.error('Fout', 'Verwijderen mislukt');
    }
  };

  const connected = !!account;
  const administrationOptions = administrations.map(a => ({ value: a.id, label: a.name }));

  return (
    <>
      <h4>Boekhouding</h4>
      <div
        className="plugin"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setOpen(true);
        }}
      >
        <span className="plugin-icon">
          <Bird size={24} />
        </span>
        <span className="information">
          <span className="title">Moneybird</span>
          <span className="description">
            {connected ? `Gekoppeld met ${account.administration}` : 'Zet je facturen vanzelf in je boekhouding'}
          </span>
        </span>
        <span onClick={(event) => event.stopPropagation()}>
          <Toggle
            label="Moneybird"
            checked={connected}
            disabled={account === undefined}
            onChange={(on) => (on ? setOpen(true) : remove())}
          />
        </span>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="">
        <div className="plugin-detail">
          <span className="plugin-icon large">
            <Bird size={40} />
          </span>

          <div className="plugin-detail-title">
            <div>
              <h2>Moneybird</h2>
              <span className="description">Door Synbased</span>
            </div>
            {connected ? (
              <button type="button" className="button negative" onClick={remove}>
                Verwijderen
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={saving || !apiToken.trim() || (administrations.length > 0 && !administrationId)}
                onClick={install}
              >
                {saving ? 'Controleren...' : 'Installeren'}
              </button>
            )}
          </div>

          <p>
            Elke factuur die je verstuurt of als verzonden markeert, staat met Moneybird meteen in je boekhouding:
            met de klant, de regels en de juiste btw. Zet je hem op betaald, dan gebeurt dat in Moneybird ook. Je
            boekhouder hoeft niets meer over te tikken.
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

          {connected ? (
            <>
              <h3>Bestaande facturen</h3>
              <p>
                Facturen van vóór de koppeling, of die eerder niet overgingen, zet je hiermee alsnog in Moneybird.
                Wat er al in staat, wordt overgeslagen.
              </p>
              <div className="form-row">
                <button type="button" className="button cancel" onClick={sync} disabled={syncing}>
                  {syncing ? 'Bezig...' : 'Facturen overzetten'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>API-token</h3>
              <p>
                Maak in Moneybird bij{' '}
                <a href={TOKENS} target="_blank" rel="noreferrer">
                  Instellingen &gt; Ontwikkelaars
                </a>{' '}
                een API-token aan voor persoonlijk gebruik, met toegang tot Verkoop en Contacten, en plak het hieronder.
              </p>
              <div className="form-section">
                <input
                  type="password"
                  value={apiToken}
                  autoComplete="off"
                  placeholder="Vul je API-token in"
                  aria-label="API-token van Moneybird"
                  onChange={(event) => {
                    setApiToken(event.target.value);
                    setAdministrations([]);
                    setAdministrationId('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && apiToken.trim() && !saving) install();
                  }}
                />
                {administrations.length > 0 && (
                  <div className="form-group">
                    <label>Administratie</label>
                    <Select
                      value={administrationOptions.find(o => o.value === administrationId) || null}
                      onChange={(option) => setAdministrationId(option?.value || '')}
                      options={administrationOptions}
                      placeholder="Kies je administratie"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <h3>Informatie</h3>
          <dl className="plugin-info">
            <dt>Mogelijkheden</dt>
            <dd>Facturen, creditfacturen en betalingen naar je boekhouding</dd>
            <dt>Ontwikkelaar</dt>
            <dd>Synbased</dd>
            <dt>Categorie</dt>
            <dd>Boekhouding</dd>
            <dt>Kosten</dt>
            <dd>Een Moneybird-abonnement</dd>
            <dt>API-tokens beheren</dt>
            <dd>
              <a href={TOKENS} target="_blank" rel="noreferrer" aria-label="API-tokens beheren">
                <ExternalLink size={15} />
              </a>
            </dd>
          </dl>

          <p className="field-note">
            Zonder Moneybird blijft alles werken: bij Btw-overzicht exporteer je je facturen per kwartaal voor je
            boekhouder. Je token staat versleuteld opgeslagen en kun je hier op elk moment verwijderen of bij Moneybird
            intrekken.
          </p>
        </div>
      </Modal>
    </>
  );
}
