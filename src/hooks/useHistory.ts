import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * In een invoerveld of in de tekstverwerker doet de browser het ongedaan maken
 * zelf, letter voor letter. Daar blijven we vanaf: anders zou één toetsaanslag
 * de hele offerte terugdraaien.
 */
function inTekstveld(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;

  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

/**
 * Stappen terug en weer vooruit, met Cmd+Z en Cmd+Shift+Z.
 *
 * De toestand wordt bij elke wijziging bewaard, maar wijzigingen die snel op
 * elkaar volgen tellen als één stap — anders zou je bij het typen van een
 * titel per letter terug moeten. Dat is ook hoe Word en Figma het doen.
 */
export function useHistory<T>(
  waarde: T,
  herstel: (waarde: T) => void,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const verleden = useRef<string[]>([]);
  const toekomst = useRef<string[]>([]);
  const vorige = useRef<string | null>(null);
  const laatsteStap = useRef(0);
  const zelfGedaan = useRef(false);
  const [stand, setStand] = useState(0);

  const nu = JSON.stringify(waarde);

  useEffect(() => {
    if (!enabled) return;

    // De eerste keer is er nog niets om naar terug te gaan
    if (vorige.current === null) {
      vorige.current = nu;
      return;
    }

    if (nu === vorige.current) return;

    // Een stap terug is zelf ook een wijziging; die hoort niet in de lijst
    if (zelfGedaan.current) {
      zelfGedaan.current = false;
      vorige.current = nu;
      return;
    }

    const tijd = Date.now();
    if (tijd - laatsteStap.current > 500) {
      verleden.current.push(vorige.current);
      // Meer dan honderd stappen terug heeft niemand nodig
      if (verleden.current.length > 100) verleden.current.shift();
      laatsteStap.current = tijd;
    }

    toekomst.current = [];
    vorige.current = nu;
    setStand(s => s + 1);
  }, [nu, enabled]);

  const spring = useCallback(
    (vanaf: React.MutableRefObject<string[]>, naar: React.MutableRefObject<string[]>) => {
      const staat = vanaf.current.pop();
      if (staat === undefined || vorige.current === null) return;

      naar.current.push(vorige.current);
      zelfGedaan.current = true;
      vorige.current = staat;
      // Een sprong breekt het groeperen af, anders zou de volgende wijziging
      // er nog bij getrokken worden
      laatsteStap.current = 0;

      herstel(JSON.parse(staat) as T);
      setStand(s => s + 1);
    },
    [herstel]
  );

  const terug = useCallback(() => spring(verleden, toekomst), [spring]);
  const opnieuw = useCallback(() => spring(toekomst, verleden), [spring]);

  useEffect(() => {
    if (!enabled) return;

    const toets = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (inTekstveld()) return;

      event.preventDefault();
      if (event.shiftKey) opnieuw();
      else terug();
    };

    document.addEventListener('keydown', toets);
    return () => document.removeEventListener('keydown', toets);
  }, [enabled, terug, opnieuw]);

  return {
    terug,
    opnieuw,
    kanTerug: verleden.current.length > 0,
    kanOpnieuw: toekomst.current.length > 0,
    // Zodat het scherm meetelt hoe vaak er iets veranderde
    stand,
  };
}
