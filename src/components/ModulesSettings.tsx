import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { clearMailAccount, reloadMailAccount, useMailAccount } from '@/hooks/useMailAccount';
import { MAIL_CHANNEL, type MailProviderName } from '@/lib/mail/types';

const PROVIDER_NAMES: Record<MailProviderName, string> = {
  google: 'Google',
  microsoft: 'Outlook',
};

/**
 * Instellingen > Modules: de onderdelen die je zelf aanzet.
 *
 * Inbox aanzetten opent een venster waarin je kiest tussen Google en Outlook.
 * Het inloggen gebeurt in een popup bij de aanbieder zelf; is dat gelukt, dan
 * sluit alles vanzelf en staat de schakelaar op groen.
 */
export default function ModulesSettings() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const account = useMailAccount();
  const [connectOpen, setConnectOpen] = useState(false);
  const [connecting, setConnecting] = useState<MailProviderName | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const popup = useRef<Window | null>(null);

  // Het popupvenster meldt zich als het klaar is
  useEffect(() => {
    const handle = async (data: any) => {
      if (data?.type !== 'mail-connected') return;

      setConnecting(null);
      if (!data.ok) {
        toast.error('Koppelen mislukt', data.error || 'Probeer het opnieuw');
        return;
      }

      const connected = await reloadMailAccount();
      setConnectOpen(false);
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
      if (connected) setConnectOpen(false);
    }, 800);

    return () => clearInterval(timer);
  }, [connecting]);

  const connect = (provider: MailProviderName) => {
    const url = `/api/mail/connect/${provider}`;
    const width = 520;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

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

  return (
    <>
      <h2>Modules</h2>

      <div className="row-section">
        <div className="information">
          <span className="title">Inbox</span>
          <span className="description">
            {account
              ? `Gekoppeld met ${account.email} via ${PROVIDER_NAMES[account.provider]}.`
              : 'Koppel je Gmail- of Outlook-mailbox en lees en beantwoord je mail vanuit Resynked.'}
          </span>
        </div>
        <div>
          <Toggle
            label="Inbox"
            checked={!!account}
            disabled={account === undefined || disconnecting}
            onChange={(on) => (on ? setConnectOpen(true) : disconnect())}
          />
        </div>
      </div>

      <Modal isOpen={connectOpen} onClose={() => setConnectOpen(false)} title="Inbox koppelen">
        <p>
          Log in bij je mailaanbieder en geef Resynked toestemming om je mail te lezen en te
          versturen. Antwoorden die je hier schrijft staan daarna ook gewoon in je eigen mailbox.
        </p>
        <div className="buttons">
          <button
            type="button"
            className="button cancel"
            disabled={connecting !== null}
            onClick={() => connect('google')}
          >
            {connecting === 'google' ? 'Bezig met inloggen...' : 'Inloggen met Google'}
          </button>
          <button
            type="button"
            className="button cancel"
            disabled={connecting !== null}
            onClick={() => connect('microsoft')}
          >
            {connecting === 'microsoft' ? 'Bezig met inloggen...' : 'Inloggen met Outlook'}
          </button>
        </div>
      </Modal>
    </>
  );
}
