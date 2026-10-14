import { useEffect, useState } from 'react';

/**
 * Hoeveel er ongelezen in de inbox staat, voor het getal achter Inbox in de
 * zijbalk.
 *
 * De zijbalk staat op elke pagina; het getal wordt hooguit eens per minuut
 * opgehaald en verder gedeeld. Leest iemand in de Inbox een bericht, dan zet
 * die het getal zelf bij, zodat de zijbalk meteen meeloopt.
 */
const MAX_AGE = 60_000;

let current: number | null = null;
let fetchedAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<(count: number | null) => void>();

function publish(count: number | null) {
  current = count;
  listeners.forEach(listener => listener(count));
}

function load() {
  if (loading || Date.now() - fetchedAt < MAX_AGE) return;

  loading = fetch('/api/mail/unread')
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      fetchedAt = Date.now();
      publish(typeof data?.count === 'number' ? data.count : null);
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
}

/** Het getal is bekend uit de Inbox zelf; dan hoeft het niet opgehaald te worden. */
export function setMailUnread(count: number) {
  fetchedAt = Date.now();
  publish(Math.max(0, count));
}

/** Eén minder, als er een ongelezen gesprek geopend wordt. */
export function decreaseMailUnread() {
  if (current !== null) publish(Math.max(0, current - 1));
}

/** null zolang het onbekend is. */
export function useMailUnread(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(current);

  useEffect(() => {
    if (!enabled) return;

    listeners.add(setCount);
    load();
    const timer = setInterval(load, MAX_AGE);

    return () => {
      listeners.delete(setCount);
      clearInterval(timer);
    };
  }, [enabled]);

  return enabled ? count : null;
}
