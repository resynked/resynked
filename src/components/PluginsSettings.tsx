import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import PluginDetail, { PLUGINS } from '@/components/PluginDetail';
import Toggle from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { clearMailAccount, reloadMailAccount, useMailAccount } from '@/hooks/useMailAccount';
import { MAIL_CHANNEL, type MailProviderName } from '@/lib/mail/types';

const PROVIDER_NAMES: Record<MailProviderName, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

/**
 * Instellingen > Plug-ins: koppelingen met andere diensten.
 *
 * Een schakelaar aanzetten opent een venster over die dienst, met de inlogknop
 * en uitleg over goedkeuring door een beheerder.
 * Het inloggen gebeurt in een popup bij de aanbieder zelf; is dat gelukt, dan
 * sluit alles vanzelf en staat de schakelaar op groen.
 *
 * Er is één mailbox per gebruiker: wie Microsoft koppelt terwijl Google
 * gekoppeld is, vervangt die koppeling.
 */
export default function PluginsSettings() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const account = useMailAccount();
  // Voor welke dienst het inlogvenster open staat
  const [dialogFor, setDialogFor] = useState<MailProviderName | null>(null);
  const [connecting, setConnecting] = useState<MailProviderName | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  // De laatste poging strandde op toestemming van een beheerder
  const [adminRequired, setAdminRequired] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string | null; microsoftAdminConsentUrl: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/mail/plugins')
      .then(res => (res.ok ? res.json() : null))
      .then(setConfig)
      .catch(() => {});
  }, []);
  const popup = useRef<Window | null>(null);
  // De popup meldt zich via twee wegen tegelijk (zie de terugkeer-route);
  // alleen de eerste melding telt, anders komt elke melding dubbel
  const reported = useRef(false);

  // Het popupvenster meldt zich als het klaar is
  useEffect(() => {
    const handle = async (data: any) => {
      if (data?.type !== 'mail-connected' || reported.current) return;
      reported.current = true;

      setConnecting(null);
      if (!data.ok) {
        // Het venster blijft open, met de uitleg voor de beheerder uitgelicht
        setAdminRequired(!!data.adminRequired);
        toast.error(data.adminRequired ? 'Goedkeuring nodig' : 'Koppelen mislukt', data.error || 'Probeer het opnieuw');
        return;
      }

      const connected = await reloadMailAccount();
      setDialogFor(null);
      setAdminRequired(false);
      toast.success(
        'Gekoppeld',
        connected ? `Je mail en agenda van ${connected.email} staan nu in Resynked` : 'Je account is gekoppeld'
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) handle(event.data);
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(MAIL_CHANNEL);
      channel.onmessage = (event) => handle(event.data);
    } catch {
      // Zonder BroadcastChannel blijft het bericht via window.opener over
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [toast]);

  // Sluit iemand de popup zonder iets te melden, dan kijken we zelf hoe het staat
  useEffect(() => {
    if (!connecting) return;

    const timer = setInterval(async () => {
      if (!popup.current || !popup.current.closed) return;

      clearInterval(timer);
      setConnecting(null);
      const connected = await reloadMailAccount();
      if (connected) setDialogFor(null);
    }, 800);

    return () => clearInterval(timer);
  }, [connecting]);

  const connect = (provider: MailProviderName) => {
    const url = `/api/mail/connect/${provider}`;
    const width = 520;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    reported.current = false;
    popup.current = window.open(url, 'mail-connect', `width=${width},height=${height},left=${left},top=${top}`);

    // Popups tegengehouden: dan in dit venster, en komen we na afloop hier terug
    if (!popup.current) {
      window.location.href = url;
      return;
    }

    setConnecting(provider);
  };

  const disconnect = async () => {
    const confirmed = await confirm({
      title: `${account ? PROVIDER_NAMES[account.provider] : 'Koppeling'} uitzetten`,
      message: `${account?.email || 'Je account'} wordt ontkoppeld; Inbox en Agenda verdwijnen uit Resynked. Je mail en afspraken blijven gewoon in ${account ? PROVIDER_NAMES[account.provider] : 'je account'} staan.`,
      confirmText: 'Uitzetten',
      cancelText: 'Annuleren',
    });

    if (!confirmed) return false;

    setDisconnecting(true);
    try {
      const response = await fetch('/api/mail/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      clearMailAccount();
      toast.success('Verwijderd', 'Je account is ontkoppeld');
      return true;
    } catch {
      toast.error('Fout', 'Ontkoppelen mislukt');
      return false;
    } finally {
      setDisconnecting(false);
    }
  };

  const dialogPlugin = PLUGINS.find(plugin => plugin.provider === dialogFor);

  const openDetail = (provider: MailProviderName) => {
    setAdminRequired(false);
    setDialogFor(provider);
  };

  return (
    <>
      <h2>Plug-ins</h2>

      <div className="plugin-list">
        {PLUGINS.map(({ provider, icon: Icon, summary }) => {
          const connected = account?.provider === provider;

          // Een klik op de rij opent het venster over deze plug-in; de
          // schakelaar zelf zet hem direct aan of uit
          return (
            <div
              key={provider}
              className="plugin"
              role="button"
              tabIndex={0}
              onClick={() => openDetail(provider)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openDetail(provider);
              }}
            >
              <span className="plugin-icon">
                <Icon size={24} />
              </span>
              <span className="information">
                <span className="title">{PROVIDER_NAMES[provider]}</span>
                <span className="description">{connected ? `Gekoppeld met ${account.email}` : summary}</span>
              </span>
              <span onClick={(event) => event.stopPropagation()}>
                <Toggle
                  label={PROVIDER_NAMES[provider]}
                  checked={connected}
                  disabled={account === undefined || disconnecting}
                  onChange={(on) => (on ? openDetail(provider) : disconnect())}
                />
              </span>
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!dialogPlugin} onClose={() => setDialogFor(null)} title="">
        {dialogPlugin && (
          <PluginDetail
            plugin={dialogPlugin}
            replaces={
              account && account.provider !== dialogPlugin.provider
                ? { name: PROVIDER_NAMES[account.provider], email: account.email }
                : null
            }
            connected={account?.provider === dialogPlugin.provider}
            connecting={connecting !== null}
            onConnect={() => connect(dialogPlugin.provider)}
            onRemove={async () => {
              if (await disconnect()) setDialogFor(null);
            }}
            adminRequired={adminRequired}
            config={config}
          />
        )}
      </Modal>
    </>
  );
}
