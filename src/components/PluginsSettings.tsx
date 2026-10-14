import { useEffect, useRef, useState } from 'react';
import { ComponentType } from 'react';
import Modal from '@/components/Modal';
import { GoogleIcon, MicrosoftIcon } from '@/components/BrandIcons';
import Toggle from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { clearMailAccount, reloadMailAccount, useMailAccount } from '@/hooks/useMailAccount';
import { MAIL_CHANNEL, type MailProviderName } from '@/lib/mail/types';

const PROVIDER_NAMES: Record<MailProviderName, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

/** De plug-ins die je kunt aanzetten, met hun logo en wat ze doen. */
const PLUGINS: { provider: MailProviderName; icon: ComponentType<{ size?: number }>; description: string }[] = [
  { provider: 'google', icon: GoogleIcon, description: 'Lees en beantwoord je Gmail in je Inbox' },
  { provider: 'microsoft', icon: MicrosoftIcon, description: 'Lees en beantwoord je Outlook-mail in je Inbox' },
];

/**
 * Instellingen > Plug-ins: koppelingen met andere diensten.
 *
 * Een schakelaar aanzetten opent een venster met de inlogknop van die dienst.
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
        toast.error('Koppelen mislukt', data.error || 'Probeer het opnieuw');
        return;
      }

      const connected = await reloadMailAccount();
      setDialogFor(null);
      toast.success('Inbox geactiveerd', connected ? `Je mail van ${connected.email} staat nu in je Inbox` : 'Je mailbox is gekoppeld');
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
      title: 'Inbox uitzetten',
      message: `Je mailbox ${account?.email || ''} wordt ontkoppeld. Je mail blijft gewoon in ${account ? PROVIDER_NAMES[account.provider] : 'je mailbox'} staan.`,
      confirmText: 'Uitzetten',
      cancelText: 'Annuleren',
    });

    if (!confirmed) return;

    setDisconnecting(true);
    try {
      const response = await fetch('/api/mail/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      clearMailAccount();
      toast.success('Inbox uitgezet', 'Je mailbox is ontkoppeld');
    } catch {
      toast.error('Fout', 'Ontkoppelen mislukt');
    } finally {
      setDisconnecting(false);
    }
  };

  const dialogPlugin = PLUGINS.find(plugin => plugin.provider === dialogFor);

  return (
    <>
      <h2>Plug-ins</h2>

      <div className="plugin-list">
        {PLUGINS.map(({ provider, icon: Icon, description }) => {
          const connected = account?.provider === provider;

          // Een label om de hele rij: een klik waar dan ook op de rij zet de
          // schakelaar om, net als een klik op de schakelaar zelf
          return (
            <label key={provider} className="plugin">
              <span className="plugin-icon">
                <Icon size={24} />
              </span>
              <span className="information">
                <span className="title">{PROVIDER_NAMES[provider]}</span>
                <span className="description">{connected ? `Gekoppeld met ${account.email}` : description}</span>
              </span>
              <Toggle
                label={PROVIDER_NAMES[provider]}
                checked={connected}
                disabled={account === undefined || disconnecting}
                onChange={(on) => (on ? setDialogFor(provider) : disconnect())}
              />
            </label>
          );
        })}
      </div>

      <Modal
        isOpen={!!dialogPlugin}
        onClose={() => setDialogFor(null)}
        title={dialogPlugin ? `Koppelen met ${PROVIDER_NAMES[dialogPlugin.provider]}` : ''}
      >
        {dialogPlugin && (
          <>
            <p>
              Log in en geef Resynked toestemming om je mail te lezen en te versturen. Antwoorden
              die je in je Inbox schrijft staan daarna ook gewoon in je eigen mailbox.
              {account && account.provider !== dialogPlugin.provider &&
                ` Je koppeling met ${PROVIDER_NAMES[account.provider]} (${account.email}) wordt hiermee vervangen.`}
            </p>
            <button
              type="button"
              className="button tertiary with-icon"
              disabled={connecting !== null}
              onClick={() => connect(dialogPlugin.provider)}
            >
              <dialogPlugin.icon size={18} />
              {connecting ? 'Bezig met inloggen...' : `Inloggen met ${PROVIDER_NAMES[dialogPlugin.provider]}`}
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
