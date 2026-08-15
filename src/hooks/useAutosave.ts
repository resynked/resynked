import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface AutosaveOptions {
  /** Pas beginnen als de gegevens geladen zijn, anders wordt het scherm leeg opgeslagen */
  enabled: boolean;
  /** Hoe lang er na de laatste wijziging gewacht wordt */
  delay?: number;
}

/**
 * Slaat wijzigingen vanzelf op zodra iemand even ophoudt met typen. Valt de
 * stroom uit of gaat het tabblad dicht, dan staat het werk er nog.
 *
 * Er wordt vergeleken op de inhoud, niet op het aantal wijzigingen: klikt
 * iemand een waarde heen en weer naar dezelfde stand, dan gaat er niets heen.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  { enabled, delay = 2000 }: AutosaveOptions
) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Wat er als laatste in de database staat; null zolang we dat nog niet weten
  const lastSaved = useRef<string | null>(null);

  // Zo blijft een nieuwe save-functie per render buiten de afhankelijkheden
  const saveRef = useRef(save);
  saveRef.current = save;

  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (!enabled) return;

    // Het eerste wat we te zien krijgen is wat er al opgeslagen is
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }

    if (lastSaved.current === serialized) return;

    setStatus('pending');

    const timer = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveRef.current(value);
        lastSaved.current = serialized;
        setSavedAt(new Date());
        setStatus('saved');
      } catch {
        // De volgende wijziging probeert het opnieuw; tussendoor ziet de
        // gebruiker in de kop dat het niet gelukt is
        setStatus('error');
      }
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, delay]);

  // Sluit iemand het tabblad terwijl er nog iets klaarstaat, dan waarschuwt de browser
  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (!enabled || lastSaved.current === null || lastSaved.current === serialized) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [serialized, enabled]);

  return { status, savedAt };
}

/** De regel die bij de status in de kop komt te staan. */
export function autosaveLabel(status: AutosaveStatus, savedAt: Date | null): string {
  if (status === 'saving' || status === 'pending') return 'Opslaan...';
  if (status === 'error') return 'Automatisch opslaan mislukt';
  if (status === 'saved' && savedAt) {
    return `Opgeslagen om ${savedAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return '';
}
