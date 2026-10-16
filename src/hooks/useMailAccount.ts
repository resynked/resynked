import { useEffect, useState } from 'react';
import type { MailProviderName } from '@/lib/mail/types';

export interface MailAccount {
  provider: MailProviderName;
  email: string;
}

/**
 * De gekoppelde mailbox, gedeeld door alles op het scherm.
 *
 * De zijbalk vraagt hem op elke pagina op; hij wordt één keer opgehaald en
 * daarna onthouden. Koppelt of ontkoppelt iemand bij Instellingen, dan ziet de
 * zijbalk dat meteen, zonder de pagina te verversen.
 */
let current: MailAccount | null | undefined;
let loading: Promise<MailAccount | null> | null = null;
const listeners = new Set<(account: MailAccount | null) => void>();

function publish(account: MailAccount | null) {
  current = account;
  listeners.forEach(listener => listener(account));
}

function load(): Promise<MailAccount | null> {
  if (!loading) {
    loading = fetch('/api/mail/account')
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

/** Opnieuw ophalen, bijvoorbeeld na het koppelen. */
export function reloadMailAccount(): Promise<MailAccount | null> {
  loading = null;
  return load();
}

/** Na het ontkoppelen hoeft er niets opgehaald te worden. */
export function clearMailAccount() {
  loading = Promise.resolve(null);
  publish(null);
}

/**
 * undefined zolang het nog geladen wordt, null als er niets gekoppeld is.
 * Met enabled false wordt er niets opgehaald, zoals in het voorbeeld op de website.
 */
export function useMailAccount(enabled = true): MailAccount | null | undefined {
  const [account, setAccount] = useState<MailAccount | null | undefined>(current);

  useEffect(() => {
    if (!enabled) return;
    listeners.add(setAccount);
    load();
    return () => {
      listeners.delete(setAccount);
    };
  }, [enabled]);

  return account;
}
