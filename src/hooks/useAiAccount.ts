import { useEffect, useState } from 'react';
import type { AiProviderName } from '@/lib/ai/types';

export interface AiAccount {
  provider: AiProviderName;
}

/**
 * De AI-koppeling, gedeeld door alles op het scherm: Plug-ins zet hem aan,
 * de Inbox laat dan de knop "Omzetten naar offerte" zien. Eén keer opgehaald
 * en daarna onthouden, zoals de mailkoppeling.
 */
let current: AiAccount | null | undefined;
let loading: Promise<AiAccount | null> | null = null;
const listeners = new Set<(account: AiAccount | null) => void>();

function publish(account: AiAccount | null) {
  current = account;
  listeners.forEach(listener => listener(account));
}

function load(): Promise<AiAccount | null> {
  if (!loading) {
    loading = fetch('/api/ai/account')
      .then(res => {
        // Nog niet ingelogd: niet onthouden, na het inloggen opnieuw vragen
        if (!res.ok) loading = null;
        return res.ok ? res.json() : { account: null };
      })
      .then(data => data.account ?? null)
      .catch(() => null)
      .then(account => {
        publish(account);
        return account;
      });
  }
  return loading;
}

/** Na het aan- of uitzetten: de nieuwe stand meteen aan iedereen doorgeven. */
export function setAiAccount(account: AiAccount | null) {
  loading = Promise.resolve(account);
  publish(account);
}

/** undefined zolang het nog geladen wordt, null als er niets gekoppeld is. */
export function useAiAccount(): AiAccount | null | undefined {
  const [account, setAccount] = useState<AiAccount | null | undefined>(current);

  useEffect(() => {
    listeners.add(setAccount);
    load();
    return () => {
      listeners.delete(setAccount);
    };
  }, []);

  return account;
}
