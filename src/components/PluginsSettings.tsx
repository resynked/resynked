import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import PluginDetail, { PLUGINS, WHATSAPP_PLUGIN, type PluginProvider } from '@/components/PluginDetail';
import AiPluginsSection from '@/components/AiPluginsSection';
import Toggle from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useAiAccount } from '@/hooks/useAiAccount';
import { clearMailAccount, reloadMailAccount, useMailAccount } from '@/hooks/useMailAccount';
import { MAIL_CHANNEL, type MailProviderName } from '@/lib/mail/types';
import type { WhatsAppAccountInfo, WhatsAppConfig } from '@/lib/whatsapp/types';

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
 *
 * WhatsApp koppelt geen mailbox maar een telefoonnummer, en staat daar los
 * van. Installeren geeft een code die de gebruiker vanaf zijn telefoon naar de
 * bot stuurt; zolang die code openstaat kijken we af en toe of hij binnen is.
 */
export default function PluginsSettings() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const account = useMailAccount();
  // Voor welke dienst het inlogvenster open staat
  const [dialogFor, setDialogFor] = useState<PluginProvider | null>(null);
  const [connecting, setConnecting] = useState<MailProviderName | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  // De laatste poging strandde op toestemming van een beheerder
  const [adminRequired, setAdminRequired] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string | null; microsoftAdminConsentUrl: string | null } | null>(null);
  const aiAccount = useAiAccount();
  // undefined zolang het nog geladen wordt, null als er geen nummer gekoppeld is
  const [whatsapp, setWhatsapp] = useState<WhatsAppAccountInfo | null | undefined>(undefined);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
  const [whatsappBusy, setWhatsappBusy] = useState(false);

  useEffect(() => {
    fetch('/api/mail/plugins')
      .then(res => (res.ok ? res.json() : null))
      .then(setConfig)
      .catch(() => {});
    fetch('/api/whatsapp/account')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setWhatsapp(data?.account ?? null);
        setWhatsappConfig(data?.config ?? null);
      })
      .catch(() => {});
  }, []);

  // Staat er een WhatsApp-code open, dan kijken we of hij al vanaf de telefoon gestuurd is
  const whatsappWaiting = !!whatsapp?.linking && !whatsapp.phone;
  useEffect(() => {
    if (!whatsappWaiting) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/account');
        if (!res.ok) return;
        const { account: next }: { account: WhatsAppAccountInfo | null } = await res.json();
        setWhatsapp(next);
        if (next?.phone) toast.success('Gekoppeld', `Berichten van ${next.phone} worden nu offertes in Resynked`);
      } catch {
        // Volgende keer opnieuw
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [whatsappWaiting, toast]);
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

  const connectWhatsapp = async () => {
    setWhatsappBusy(true);
    try {
      const response = await fetch('/api/whatsapp/account', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Er kon geen code worden gemaakt');
      setWhatsapp(data.account);
    } catch (error: any) {
      toast.error('Installeren mislukt', error.message);
    } finally {
      setWhatsappBusy(false);
    }
  };

  const disconnectWhatsapp = async () => {
    const confirmed = await confirm({
      title: 'WhatsApp uitzetten',
      message: `${whatsapp?.phone || 'Je nummer'} wordt ontkoppeld; berichten aan de bot worden dan geen offertes meer. Offertes die al gemaakt zijn blijven staan.`,
      confirmText: 'Uitzetten',
      cancelText: 'Annuleren',
    });

    if (!confirmed) return false;

    setWhatsappBusy(true);
    try {
      const response = await fetch('/api/whatsapp/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setWhatsapp(null);
      toast.success('Verwijderd', 'Je nummer is ontkoppeld');
      return true;
    } catch {
      toast.error('Fout', 'Ontkoppelen mislukt');
      return false;
    } finally {
      setWhatsappBusy(false);
    }
  };

  const dialogPlugin =
    dialogFor === 'whatsapp' ? (whatsappConfig ? WHATSAPP_PLUGIN : undefined) : PLUGINS.find(plugin => plugin.provider === dialogFor);

  const openDetail = (provider: PluginProvider) => {
    setAdminRequired(false);
    setDialogFor(provider);
  };

  return (
    <>
      <h2>Plug-ins</h2>

      {/* Eén lijst, met per groep een kopje over de volle breedte */}
      <div className="plugin-list">
        <h4>E-mail en agenda</h4>
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

        <h4>Berichten</h4>
        <div
          className="plugin"
          role="button"
          tabIndex={0}
          onClick={() => openDetail('whatsapp')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') openDetail('whatsapp');
          }}
        >
          <span className="plugin-icon">
            <WHATSAPP_PLUGIN.icon size={24} />
          </span>
          <span className="information">
            <span className="title">{WHATSAPP_PLUGIN.name}</span>
            <span className="description">
              {whatsapp?.phone
                ? `Gekoppeld met ${whatsapp.phone}`
                : whatsappConfig && !whatsappConfig.configured
                  ? 'Nog niet beschikbaar'
                  : WHATSAPP_PLUGIN.summary}
            </span>
          </span>
          <span onClick={(event) => event.stopPropagation()}>
            <Toggle
              label={WHATSAPP_PLUGIN.name}
              checked={!!whatsapp?.phone}
              disabled={whatsapp === undefined || !whatsappConfig?.configured || whatsappBusy}
              onChange={(on) => (on ? openDetail('whatsapp') : disconnectWhatsapp())}
            />
          </span>
        </div>

        <AiPluginsSection />
      </div>

      <Modal isOpen={!!dialogPlugin} onClose={() => setDialogFor(null)} title="">
        {dialogPlugin?.provider === 'whatsapp' && whatsappConfig && (
          <PluginDetail
            plugin={dialogPlugin}
            replaces={null}
            connected={!!whatsapp?.phone}
            connecting={whatsappBusy}
            onConnect={connectWhatsapp}
            onRemove={async () => {
              if (await disconnectWhatsapp()) setDialogFor(null);
            }}
            adminRequired={false}
            config={null}
            whatsapp={{ account: whatsapp ?? null, config: whatsappConfig, hasAi: !!aiAccount }}
          />
        )}
        {dialogPlugin && dialogPlugin.provider !== 'whatsapp' && (
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
