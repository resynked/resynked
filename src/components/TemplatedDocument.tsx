import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TemplatedDocumentProps {
  /** De HTML die de aannemer bij Instellingen heeft geplakt */
  html: string;
  /** Losse waarden voor {{plaatshouders}} in de tekst */
  values: Record<string, string>;
  /** Inhoud voor de plekken met data-slot, die met de offerte meegroeien */
  slots: Record<string, ReactNode>;
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

  return doc.body.innerHTML;
}

/**
 * Rendert het eigen sjabloon van een aannemer en vult de plekken met
 * data-slot met echte inhoud. Het sjabloon bepaalt de vormgeving, het
 * systeem levert de regels — zo blijft een lange offerte netjes doorlopen.
 */
export default function TemplatedDocument({ html, values, slots }: TemplatedDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<{ name: string; element: HTMLElement }[]>([]);

  // De sanitize gebruikt DOMParser, dus dit gebeurt pas in de browser
  const [safeHtml, setSafeHtml] = useState('');

  useEffect(() => {
    setSafeHtml(sanitize(fillPlaceholders(html, values)));
  }, [html, values]);

  useEffect(() => {
    if (!containerRef.current) return;

    const found: { name: string; element: HTMLElement }[] = [];
    containerRef.current.querySelectorAll<HTMLElement>('[data-slot]').forEach((element) => {
      const name = element.getAttribute('data-slot');
      if (name) found.push({ name, element });
    });

    setTargets(found);
  }, [safeHtml]);

  return (
    <>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: safeHtml }} />
      {targets.map(({ name, element }) =>
        slots[name] ? createPortal(slots[name], element, name) : null
      )}
    </>
  );
}
