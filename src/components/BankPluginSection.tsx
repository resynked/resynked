import { useEffect, useState } from 'react';
import { Landmark, Link2, RefreshCw } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import Select from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDate } from '@/lib/utils';

/** Wat de bankkoppeling binnen Synbased aanzet, bovenop het importeren van een afschrift */
const PARTS = [
  {
    icon: RefreshCw,
    name: 'Elke ochtend opgehaald',
    description: 'Je transacties staan vanzelf bij Bank, zonder afschrift te downloaden',
  },
  {
    icon: Link2,
    name: 'Vanzelf gekoppeld',
    description: 'Betaalt een klant, dan staat zijn factuur meteen op betaald',
  },
];

interface Connection {
  institution: string;
  status: 'linked' | 'expired';
  expiresAt: string | null;
}

/**
 * De bankkoppeling bij Instellingen > Plug-ins, als groep "Bank" in de lijst
 * van PluginsSettings. Opgezet zoals MolliePluginSection.
 *
 * De klant kiest zijn bank en geeft daar zelf toestemming; na 90 dagen
 * vraagt de bank dat opnieuw. Zonder koppeling importeert hij een afschrift.
 */
export default function BankPluginSection() {
  const toast = useToast();
  const { confirm } = useConfirm();
  // undefined zolang het laadt
  const [state, setState] = useState<
    { configured: boolean; connection: Connection | null; institutions: { id: string; name: string }[] } | undefined
  >(undefined);
  const [open, setOpen] = useState(false);
  const [institutionId, setInstitutionId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/bank/connection')
      .then(res => (res.ok ? res.json() : { configured: false, connection: null, institutions: [] }))
      .then(setState)
      .catch(() => setState({ configured: false, connection: null, institutions: [] }));
  }, []);

  /** Naar de bank om toestemming te geven; daarna komt de klant terug bij Bank */
  const connect = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/bank/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.href = data.link;
    } catch (error: any) {
      toast.error('Koppelen mislukt', error.message || 'Probeer het opnieuw');
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/bank/sync', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Opgehaald', data.imported ? `${data.imported} nieuwe transactie(s)` : 'Er waren geen nieuwe transacties');
    } catch (error: any) {
      toast.error('Ophalen mislukt', error.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Bankkoppeling verwijderen',
      message: 'Synbased haalt dan geen transacties meer op bij je bank. Wat er al staat, blijft staan; je kunt nog steeds een afschrift importeren.',
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/api/bank/connection', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setState((current) => (current ? { ...current, connection: null } : current));
      setOpen(false);
      toast.success('Verwijderd', 'De bankkoppeling is verwijderd');
    } catch {
      toast.error('Fout', 'Verwijderen mislukt');
    }
  };

  const connection = state?.connection || null;
  const connected = connection?.status === 'linked';
  const institutionOptions = (state?.institutions || []).map(i => ({ value: i.id, label: i.name }));

  return (
    <>
      <h4>Bank</h4>
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
          <Landmark size={24} />
        </span>
        <span className="information">
          <span className="title">Bankkoppeling</span>
          <span className="description">
            {connected
              ? `Gekoppeld met ${connection!.institution}`
              : connection?.status === 'expired'
                ? `Toestemming bij ${connection.institution} verlopen; koppel opnieuw`
                : 'Haal je transacties elke ochtend vanzelf op'}
          </span>
        </span>
        <span onClick={(event) => event.stopPropagation()}>
          <Toggle
            label="Bankkoppeling"
            checked={connected}
            disabled={state === undefined}
            onChange={(on) => (on ? setOpen(true) : remove())}
          />
        </span>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="">
        <div className="plugin-detail">
          <span className="plugin-icon large">
            <Landmark size={40} />
          </span>

          <div className="plugin-detail-title">
            <div>
              <h2>Bankkoppeling</h2>
              <span className="description">Door Synbased, via GoCardless</span>
            </div>
            {connected ? (
              <button type="button" className="button negative" onClick={remove}>
                Verwijderen
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={busy || !state?.configured || !institutionId}
                onClick={connect}
              >
                {busy ? 'Doorsturen...' : 'Koppelen'}
              </button>
            )}
          </div>

          <p>
            Met de bankkoppeling staan je transacties elke ochtend vanzelf bij Bank, zonder dat je een afschrift hoeft
            te downloaden. Betaalt een klant, dan staat zijn factuur meteen op betaald. Synbased kan alleen lezen: er
            kan nooit geld van je rekening af.
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

          {!state?.configured ? (
            <p className="field-note">
              De bankkoppeling is nog niet beschikbaar in deze omgeving. Importeer zolang een afschrift bij Bank.
            </p>
          ) : connected ? (
            <>
              <h3>Ophalen</h3>
              <p>
                Gekoppeld met {connection!.institution}
                {connection!.expiresAt ? `, toestemming geldig tot ${formatDate(connection!.expiresAt)}` : ''}. Elke
                ochtend halen we de nieuwe transacties op; hiermee doe je het nu meteen.
              </p>
              <div className="form-row">
                <button type="button" className="button cancel" onClick={sync} disabled={busy}>
                  {busy ? 'Bezig...' : 'Nu ophalen'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Je bank</h3>
              <p>
                Kies je bank. Je gaat daarna naar je eigen bank om in te loggen en toestemming te geven; die geldt 90
                dagen, daarna vraagt je bank het opnieuw.
              </p>
              <div className="form-section">
                <Select
                  value={institutionOptions.find(o => o.value === institutionId) || null}
                  onChange={(option) => setInstitutionId(option?.value || '')}
                  options={institutionOptions}
                  placeholder="Kies je bank"
                />
              </div>
            </>
          )}

          <h3>Informatie</h3>
          <dl className="plugin-info">
            <dt>Mogelijkheden</dt>
            <dd>Rekeninginformatie en transacties lezen</dd>
            <dt>Ontwikkelaar</dt>
            <dd>Synbased</dd>
            <dt>Categorie</dt>
            <dd>Bank</dd>
            <dt>Verbinding</dt>
            <dd>GoCardless Bank Account Data, onder PSD2-vergunning</dd>
          </dl>

          <p className="field-note">
            Zonder koppeling blijft alles werken: download in je bank-app een afschrift en importeer het bij Bank.
            Gebruik het een of het ander voor dezelfde rekening, anders kunnen transacties dubbel binnenkomen.
          </p>
        </div>
      </Modal>
    </>
  );
}
