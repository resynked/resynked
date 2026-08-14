import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TemplatedDocumentProps {
  /** De HTML die de aannemer bij Instellingen heeft geplakt */
  html: string;
  /** Losse waarden voor {{plaatshouders}} in de tekst */
  values: Record<string, string>;
  /** Inhoud voor de plekken met data-slot, die met de offerte meegroeien */
  slots: Record<string, ReactNode>;
  /** Label boven een aanklikbaar onderdeel, per slot */
  labels?: Record<string, string>;
  /** Welk onderdeel op dit moment bewerkt wordt */
  activeSlot?: string | null;
  /** Aangeroepen als er op een onderdeel geklikt wordt */
  onSelect?: (slot: string) => void;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Waarden komen uit de database en mogen de opmaak niet kunnen breken. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function fillPlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : escapeHtml(value);
  });
}

/**
 * Haalt scripts en klikhandlers uit het sjabloon. Stijlen blijven staan,
 * want daar zit de hele vormgeving in.
 */
function sanitize(html: string): string {
  if (typeof window === 'undefined') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Een <style> aan het begin van het sjabloon belandt volgens de HTML-regels
  // in de head, dus die moet er hier weer bij — anders verdwijnt de opmaak
  return doc.head.innerHTML + doc.body.innerHTML;
}

/**
 * Rendert het eigen sjabloon van een aannemer en vult de plekken met
 * data-slot met echte inhoud. Het sjabloon bepaalt de vormgeving, het
 * systeem levert de regels — zo blijft een lange offerte netjes doorlopen.
 */
export default function TemplatedDocument({
  html,
  values,
  slots,
  labels = {},
  activeSlot,
  onSelect,
}: TemplatedDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<{ name: string; element: HTMLElement }[]>([]);

  // De sanitize gebruikt DOMParser, dus dit gebeurt pas in de browser
  const [safeHtml, setSafeHtml] = useState('');

  // Alleen opnieuw opschonen als er echt iets aan de inhoud verandert
  const valuesKey = JSON.stringify(values);

  useEffect(() => {
    setSafeHtml(sanitize(fillPlaceholders(html, values)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, valuesKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // De inhoud wordt hier met de hand gezet in plaats van via
    // dangerouslySetInnerHTML: React zou de innerHTML bij elke wijziging
    // opnieuw schrijven en daarmee de inhoud van de slots weggooien
    container.innerHTML = safeHtml;

    const found: { name: string; element: HTMLElement }[] = [];
    container.querySelectorAll<HTMLElement>('[data-slot]').forEach((element) => {
      const name = element.getAttribute('data-slot');
      if (name) found.push({ name, element });
    });

    setTargets(found);
  }, [safeHtml]);

  // Elk onderdeel van het sjabloon wordt aanklikbaar om te bewerken
  useEffect(() => {
    if (!onSelect) return;

    const cleanups = targets.map(({ name, element }) => {
      const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        onSelect(name);
      };

      element.classList.add('editable-region');
      element.setAttribute('data-label', labels[name] || name);
      element.addEventListener('click', handleClick);

      return () => element.removeEventListener('click', handleClick);
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [targets, labels, onSelect]);

  useEffect(() => {
    targets.forEach(({ name, element }) => {
      element.classList.toggle('active', name === activeSlot);
    });
  }, [targets, activeSlot]);

  return (
    <>
      <div ref={containerRef} />
      {targets.map(({ name, element }) =>
        slots[name] ? createPortal(slots[name], element, name) : null
      )}
    </>
  );
}
