import { useEffect, useState } from 'react';
import { BadgeEuro, ExternalLink, Zap } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';

const DASHBOARD = 'https://my.mollie.com/dashboard/developers/api-keys';

/** Wat Mollie binnen Khance aanzet, bovenop de QR-code die iedereen al heeft */
const PARTS = [
  {
    icon: Zap,
    name: 'Nu betalen',
    description: 'Een betaalknop op de factuurpagina van je klant, met iDEAL, Bancontact en meer',
  },
  {
    icon: BadgeEuro,
    name: 'Vanzelf op betaald',
    description: 'Is er betaald, dan staat de factuur meteen op betaald, met de juiste datum',
  },
];

/**
 * Mollie bij Instellingen > Plug-ins, als groep "Betalingen" in de lijst van
 * PluginsSettings. Eén koppeling per bedrijf, met de eigen API-sleutel van de
 * aannemer: het geld gaat rechtstreeks naar zijn rekening.
 *
 * Zonder Mollie betaalt de klant gewoon met de QR-code op de factuur.
 */
export default function MolliePluginSection() {
  const toast = useToast();
  const { confirm } = useConfirm();
  // undefined zolang het laadt, null als er niets gekoppeld is
  const [account, setAccount] = useState<{ test: boolean } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/mollie/account')
      .then(res => (res.ok ? res.json() : { account: null }))
      .then(data => setAccount(data.account ?? null))
      .catch(() => setAccount(null));
  }, []);

  const install = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/mollie/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'De sleutel kon niet worden opgeslagen');

      setAccount(data.account);
      setApiKey('');
      setOpen(false);
      toast.success(
        'Geïnstalleerd',
        data.account?.test
          ? 'Mollie staat aan in testmodus; er wordt nog niet echt betaald'
          : 'Je klanten kunnen hun factuur nu direct betalen'
      );
    } catch (error: any) {
      toast.error('Installeren mislukt', error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Mollie verwijderen',
      message: 'Je API-sleutel wordt verwijderd en de betaalknop verdwijnt van je facturen. De QR-code blijft staan.',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/api/mollie/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setAccount(null);
      setOpen(false);
      toast.success('Verwijderd', 'Mollie is ontkoppeld');
    } catch {
      toast.error('Fout', 'Verwijderen mislukt');
    }
  };

  const connected = !!account;

  return (
    <>
      <h4>Betalingen</h4>
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
          <BadgeEuro size={24} />
        </span>
        <span className="information">
          <span className="title">Mollie</span>
          <span className="description">
            {connected
              ? account.test
                ? 'Geïnstalleerd in testmodus'
                : 'Geïnstalleerd; klanten betalen direct vanaf hun factuur'
              : 'Laat klanten hun factuur direct betalen met iDEAL'}
          </span>
        </span>
        <span onClick={(event) => event.stopPropagation()}>
          <Toggle
            label="Mollie"
            checked={connected}
            disabled={account === undefined}
            onChange={(on) => (on ? setOpen(true) : remove())}
          />
        </span>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="">
        <div className="plugin-detail">
          <span className="plugin-icon large">
            <BadgeEuro size={40} />
          </span>

          <div className="plugin-detail-title">
            <div>
              <h2>Mollie</h2>
              <span className="description">Door Khance</span>
            </div>
            {connected ? (
              <button type="button" className="button negative" onClick={remove}>
                Verwijderen
              </button>
            ) : (
              <button type="button" className="button" disabled={saving || !apiKey.trim()} onClick={install}>
                {saving ? 'Controleren...' : 'Installeren'}
              </button>
            )}
          </div>

          <p>
            Elke factuur heeft al een QR-code waarmee je klant betaalt met zijn bank-app. Met Mollie komt daar een
            betaalknop bij: je klant betaalt met iDEAL in een paar tikken, en de factuur staat daarna vanzelf op
            betaald. Het geld gaat rechtstreeks naar je eigen rekening.
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
                Nog geen Mollie-account? Maak er een aan op{' '}
                <a href="https://www.mollie.com/nl" target="_blank" rel="noreferrer">
                  mollie.com
                </a>
                ; dat duurt een paar minuten met je KvK-nummer en rekening. Kopieer daarna in je Mollie-dashboard
                bij Ontwikkelaars de live-sleutel (begint met <code>live_</code>) en plak hem hieronder. Eerst proberen?
                Een testsleutel (<code>test_</code>) werkt ook; dan wordt er niet echt betaald.
              </p>
              <div className="form-section">
                <input
                  type="password"
                  value={apiKey}
                  autoComplete="off"
                  placeholder="Vul je API-sleutel in"
                  aria-label="API-sleutel van Mollie"
                  onChange={(event) => setApiKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && apiKey.trim() && !saving) install();
                  }}
                />
              </div>
            </>
          )}

          <h3>Informatie</h3>
          <dl className="plugin-info">
            <dt>Mogelijkheden</dt>
            <dd>Facturen online laten betalen en automatisch op betaald zetten</dd>
            <dt>Ontwikkelaar</dt>
            <dd>Khance</dd>
            <dt>Categorie</dt>
            <dd>Betalingen</dd>
            <dt>Kosten</dt>
            <dd>Per betaling bij Mollie; iDEAL kost rond de € 0,30</dd>
            <dt>API-sleutels beheren</dt>
            <dd>
              <a href={DASHBOARD} target="_blank" rel="noreferrer" aria-label="API-sleutels beheren">
                <ExternalLink size={15} />
              </a>
            </dd>
          </dl>

          <p className="field-note">
            Zonder Mollie blijft alles werken: je klant betaalt met de QR-code en jij zet de
            factuur zelf op betaald. Je sleutel staat versleuteld opgeslagen en kun je hier op elk moment
            verwijderen of bij Mollie intrekken.
          </p>
        </div>
      </Modal>
    </>
  );
}
