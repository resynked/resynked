import { useState } from 'react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import AiPluginDetail, { AI_PLUGINS } from '@/components/AiPluginDetail';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { setAiAccount, useAiAccount } from '@/hooks/useAiAccount';
import type { AiProviderName } from '@/lib/ai/types';

const NAMES: Record<AiProviderName, string> = { anthropic: 'Anthropic', openai: 'OpenAI' };

/**
 * De AI-plug-ins bij Instellingen > Plug-ins. Eén AI-dienst per gebruiker,
 * met zijn eigen sleutel: wie OpenAI aanzet terwijl Anthropic aan staat,
 * vervangt die.
 */
export default function AiPluginsSection() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const account = useAiAccount();
  const [dialogFor, setDialogFor] = useState<AiProviderName | null>(null);
  const [saving, setSaving] = useState(false);

  const install = async (provider: AiProviderName, apiKey: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/ai/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'De sleutel kon niet worden opgeslagen');

      setAiAccount(data.account);
      setDialogFor(null);
      toast.success('Geïnstalleerd', `${NAMES[provider]} staat aan; in je Inbox kun je nu een mail omzetten naar een offerte`);
    } catch (error: any) {
      toast.error('Installeren mislukt', error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!account) return false;

    const confirmed = await confirm({
      title: `${NAMES[account.provider]} verwijderen`,
      message: 'Je API-sleutel wordt verwijderd en "Omzetten naar offerte" verdwijnt uit je Inbox.',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return false;

    try {
      const response = await fetch('/api/ai/account', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setAiAccount(null);
      toast.success('Verwijderd', 'Je API-sleutel is verwijderd');
      return true;
    } catch {
      toast.error('Fout', 'Verwijderen mislukt');
      return false;
    }
  };

  const dialogPlugin = AI_PLUGINS.find(plugin => plugin.provider === dialogFor);

  return (
    <>
      <h3>AI</h3>
      <div className="plugin-list">
        {AI_PLUGINS.map(({ provider, icon: Icon, summary }) => {
          const connected = account?.provider === provider;

          return (
            <div
              key={provider}
              className="plugin"
              role="button"
              tabIndex={0}
              onClick={() => setDialogFor(provider)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setDialogFor(provider);
              }}
            >
              <span className="plugin-icon">
                <Icon size={24} />
              </span>
              <span className="information">
                <span className="title">{NAMES[provider]}</span>
                <span className="description">{connected ? 'Geïnstalleerd met je eigen API-sleutel' : summary}</span>
              </span>
              <span onClick={(event) => event.stopPropagation()}>
                <Toggle
                  label={NAMES[provider]}
                  checked={connected}
                  disabled={account === undefined}
                  onChange={(on) => (on ? setDialogFor(provider) : remove())}
                />
              </span>
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!dialogPlugin} onClose={() => setDialogFor(null)} title="">
        {dialogPlugin && (
          <AiPluginDetail
            key={dialogPlugin.provider}
            plugin={dialogPlugin}
            connected={account?.provider === dialogPlugin.provider}
            replaces={account && account.provider !== dialogPlugin.provider ? NAMES[account.provider] : null}
            saving={saving}
            onInstall={(apiKey) => install(dialogPlugin.provider, apiKey)}
            onRemove={async () => {
              if (await remove()) setDialogFor(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
