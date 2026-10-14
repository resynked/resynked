import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
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
  /** Hoeveel keer een pagina met data-repeat herhaald moet worden */
  repeatCounts?: Record<string, number>;
  /** De titel van elk blok, als haakje voor eigen opmaak per pagina */
  repeatTitles?: string[];
  /**
   * Knoppen die op een pagina komen te liggen in plaats van erin, per slot.
   * Ze zweven over het papier en tellen dus niet mee voor wat er op past.
   */
  overlays?: Record<string, ReactNode>;
  /**
   * Aangeroepen zodra alles op zijn plek staat, nog voordat de browser het
   * tekent. Dan kan er gemeten worden zonder dat iemand een tussenstand ziet.
   */
  onLayout?: () => void;
}

/** Een tekst of attribuut in het sjabloon waar een {{plaatshouder}} in staat. */
interface Binding {
  node: Node;
  attr?: string;
  template: string;
}

/** Een pagina met data-repeat, en de kopieën die er nu van in het document staan. */
interface RepeatGroup {
  name: string;
  template: HTMLElement;
  anchor: Comment;
  copies: HTMLElement[];
}

interface SlotTarget {
  name: string;
  element: HTMLElement;
  id: number;
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/;

function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(new RegExp(PLACEHOLDER.source, 'g'), (match, key) => values[key] ?? match);
}

/**
 * Haalt scripts en klikhandlers uit het sjabloon. Stijlen blijven staan,
 * want daar zit de hele vormgeving in.
 */
function sanitize(doc: Document) {
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
}

/** Alle plekken onder `root` waar een waarde ingevuld moet worden. */
function findBindings(root: Node): Binding[] {
  const found: Binding[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (PLACEHOLDER.test(node.nodeValue || '')) found.push({ node, template: node.nodeValue || '' });
      continue;
    }

    Array.from((node as Element).attributes).forEach((attr) => {
      if (PLACEHOLDER.test(attr.value)) found.push({ node, attr: attr.name, template: attr.value });
    });
  }

  return found;
}

/**
 * Zet de waarde op zijn plek. Via de DOM en niet via HTML, dus een waarde uit
 * de database kan de opmaak niet breken.
 */
function applyBinding(binding: Binding, values: Record<string, string>) {
  const value = fillPlaceholders(binding.template, values);

  if (!binding.attr) {
    if (binding.node.nodeValue !== value) binding.node.nodeValue = value;
    return;
  }

  const el = binding.node as Element;
  const name = binding.attr.toLowerCase();

  if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
    el.removeAttribute(binding.attr);
  } else if (el.getAttribute(binding.attr) !== value) {
    el.setAttribute(binding.attr, value);
  }
}

/**
 * Rendert het eigen sjabloon van een aannemer en vult de plekken met
 * data-slot met echte inhoud. Het sjabloon bepaalt de vormgeving, het
 * systeem levert de regels — zo blijft een lange offerte netjes doorlopen.
 *
 * Het sjabloon wordt één keer opgebouwd. Daarna verandert alleen wat nodig is:
 * een waarde, een titel, een vel erbij of eraf. Zo blijven de plekken met
 * data-slot dezelfde elementen, en verliest wie in de offerte typt zijn cursor
 * niet zodra het totaal of het aantal vellen verandert.
 */
export default function TemplatedDocument({
  html,
  values,
  slots,
  labels = {},
  activeSlot,
  onSelect,
  repeatCounts = {},
  repeatTitles = [],
  overlays = {},
  onLayout,
}: TemplatedDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<SlotTarget[]>([]);

  const bindings = useRef<Binding[]>([]);
  const repeatGroups = useRef<RepeatGroup[]>([]);
  // Een vast nummer per slot-element, zodat een portaal blijft staan zolang
  // zijn element dat doet
  const ids = useRef(new WeakMap<HTMLElement, number>());
  const nextId = useRef(0);
  // De plekken zijn net veranderd en nog niet gevuld; dan valt er niets te meten
  const slotsPending = useRef(false);

  // Het sjabloon zelf, opgeschoond. DOMParser bestaat alleen in de browser
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    sanitize(doc);

    // Elke pagina met data-repeat wordt een sjabloon; op zijn plek komt een
    // anker waar de kopieën voor gezet worden
    const repeated = Array.from(doc.querySelectorAll<HTMLElement>('[data-repeat]')).filter(
      (el) => !el.parentElement?.closest('[data-repeat]')
    );

    repeatGroups.current = repeated.map((template) => {
      const anchor = doc.createComment('repeat');
      const name = template.getAttribute('data-repeat') || '';
      template.replaceWith(anchor);
      template.removeAttribute('data-repeat');
      return { name, template, anchor, copies: [] };
    });

    // Een <style> aan het begin van het sjabloon belandt volgens de HTML-regels
    // in de head, dus die moet er hier weer bij — anders verdwijnt de opmaak
    container.replaceChildren(...Array.from(doc.head.childNodes), ...Array.from(doc.body.childNodes));
    bindings.current = findBindings(container);
  }, [html]);

  // Bij elke tekening: vellen bijmaken of weghalen, waarden en titels bijwerken
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    repeatGroups.current.forEach((group) => {
      // Een document zonder blokken toont toch één vel, anders staat er niets
      const count = Math.max(repeatCounts[group.name] ?? 0, 1);

      while (group.copies.length < count) {
        const i = group.copies.length;
        const copy = group.template.cloneNode(true) as HTMLElement;

        // De slots die bij één blok horen krijgen een nummer; andere slots
        // op de pagina, zoals het eindtotaal, blijven wat ze zijn
        copy.querySelectorAll<HTMLElement>('[data-slot="blok"], [data-slot="bloktitel"]').forEach((slot) => {
          const base = slot.getAttribute('data-slot');
          slot.setAttribute('data-slot', `${base === 'bloktitel' ? 'bloktitel' : group.name}-${i}`);
        });

        group.anchor.parentNode?.insertBefore(copy, group.anchor);
        group.copies.push(copy);
        bindings.current.push(...findBindings(copy));
      }

      while (group.copies.length > count) {
        const copy = group.copies.pop()!;
        copy.remove();
        bindings.current = bindings.current.filter((binding) => !copy.contains(binding.node));
      }

      // Zo kan het sjabloon een pagina anders opmaken op zijn titel:
      // .pagina[data-blok-titel="Algemene voorwaarden"] { ... }
      group.copies.forEach((copy, i) => {
        const title = repeatTitles[i] || '';
        if (copy.getAttribute('data-blok-titel') !== title) copy.setAttribute('data-blok-titel', title);
      });
    });

    bindings.current.forEach((binding) => applyBinding(binding, values));

    const found = Array.from(container.querySelectorAll<HTMLElement>('[data-slot]'));
    const unchanged =
      found.length === targets.length &&
      found.every((element, i) => targets[i].element === element && targets[i].name === element.getAttribute('data-slot'));

    slotsPending.current = !unchanged;
    if (unchanged) return;

    setTargets(
      found.map((element) => {
        if (!ids.current.has(element)) ids.current.set(element, nextId.current++);
        return { name: element.getAttribute('data-slot') || '', element, id: ids.current.get(element)! };
      })
    );
  });

  // Elk onderdeel van het sjabloon wordt aanklikbaar om te bewerken
  useLayoutEffect(() => {
    if (!onSelect) return;

    const cleanups = targets.map(({ name, element }) => {
      // Niet tegenhouden: de velden in het slot moeten de klik ook krijgen
      const handleClick = () => onSelect(name);

      element.classList.add('editable-region');
      element.setAttribute('data-label', labels[name] || name);
      element.addEventListener('click', handleClick);

      return () => element.removeEventListener('click', handleClick);
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [targets, labels, onSelect]);

  useLayoutEffect(() => {
    targets.forEach(({ name, element }) => {
      element.classList.toggle('active', name === activeSlot);
    });
  }, [targets, activeSlot]);

  // Als laatste, zodra de slots gevuld zijn
  useLayoutEffect(() => {
    if (!slotsPending.current) onLayout?.();
  });

  return (
    <>
      <div ref={containerRef} />
      {targets.map(({ name, element, id }) =>
        // Een slot kan meerdere keren voorkomen, bijvoorbeeld het totaal op
        // elke herhaalde pagina, dus de sleutel bevat ook het element
        slots[name] ? createPortal(slots[name], element, `${name}-${id}`) : null
      )}
      {targets.map(({ name, element, id }) => {
        const overlay = overlays[name];
        if (!overlay) return null;

        // Op de pagina zelf, niet in het slot: zo ligt de knop over het
        // papier heen zonder de inhoud te verschuiven
        const page = element.closest('[data-blok-titel]') as HTMLElement | null;
        return page ? createPortal(overlay, page, `overlay-${name}-${id}`) : null;
      })}
    </>
  );
}
