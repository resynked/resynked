/**
 * Het opdelen van een offerte over vellen papier.
 *
 * Een blok hoort bij één vel, maar past er niet altijd op. Dan loopt het door
 * op een volgend vel met hetzelfde opschrift en het volgende nummer — zoals
 * "02 Werkzaamheden" en "03 Werkzaamheden". Waar de knip valt wordt gemeten
 * aan het echte papier, niet geschat: elk onderdeel dat buiten het vel valt
 * verhuist naar het volgende.
 */

import type { DocumentBlock, DocumentElement } from '@/lib/supabase';
import { duplicateElement } from '@/lib/blocks';
import { toDisplayHtml } from '@/lib/richtext';

/**
 * Eén onderdeel van een blok op een vel. Bij een tekstelement kan het om een
 * deel van de tekst gaan: `van` en `tot` tellen de alinea's, kopjes en lijsten
 * op het bovenste niveau.
 */
export interface Stuk {
  element: number;
  van?: number;
  tot?: number;
}

/** Eén vel papier: een aaneengesloten stuk van één blok. */
export interface Vel {
  blok: number;
  stukken: Stuk[];
}

/** Waar de knip valt: welk stuk, en binnen een tekst welke alinea. */
export interface Knip {
  stuk: number;
  knoop?: number;
}

/** Nog niets opgedeeld: elk blok krijgt één vel met alles erop. */
export function eersteIndeling(blocks: DocumentBlock[]): Vel[] {
  return blocks.map((block, blok) => ({
    blok,
    stukken: block.elements.map((_, element) => ({ element })),
  }));
}

/**
 * Knipt een vel in tweeën op de gegeven plek. Het eerste deel blijft staan,
 * de rest gaat naar een nieuw vel van hetzelfde blok.
 */
export function knipVel(vel: Vel, knip: Knip): [Vel, Vel] {
  const voor = vel.stukken.slice(0, knip.stuk);
  const na = vel.stukken.slice(knip.stuk + 1);
  const gedeeld = vel.stukken[knip.stuk];

  if (knip.knoop === undefined) {
    // Het hele stuk schuift door naar het volgende vel
    return [
      { blok: vel.blok, stukken: voor },
      { blok: vel.blok, stukken: [gedeeld, ...na] },
    ];
  }

  // Een tekst valt in tweeën: wat er nog op past en wat er overloopt
  const van = gedeeld.van ?? 0;
  return [
    { blok: vel.blok, stukken: [...voor, { ...gedeeld, van, tot: knip.knoop }] },
    { blok: vel.blok, stukken: [{ ...gedeeld, van: knip.knoop }, ...na] },
  ];
}

/** Twee indelingen zijn gelijk als er niets te verplaatsen viel. */
export function gelijkeIndeling(a: Vel[], b: Vel[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * De elementen die op dit vel horen, met een tekst die overloopt afgeknipt op
 * de juiste alinea. Zo krijgt de weergave precies het deel dat past.
 */
export function elementenVanVel(block: DocumentBlock, vel: Vel): { element: DocumentElement; index: number; van?: number; tot?: number }[] {
  return vel.stukken
    .filter((stuk) => block.elements[stuk.element])
    .map((stuk) => ({
      element: block.elements[stuk.element],
      index: stuk.element,
      van: stuk.van,
      tot: stuk.tot,
    }));
}

/**
 * Knipt opgemaakte tekst op het bovenste niveau. De alinea's, kopjes en
 * lijsten blijven heel; er wordt alleen tussen gesneden.
 */
export function snijTekst(html: string, van?: number, tot?: number): string {
  if (van === undefined && tot === undefined) return html;
  if (typeof window === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const knopen = Array.from(doc.body.childNodes);

  return knopen
    .slice(van ?? 0, tot ?? knopen.length)
    .map((knoop) => (knoop.nodeType === 1 ? (knoop as HTMLElement).outerHTML : knoop.textContent || ''))
    .join('');
}

/**
 * Maakt van de knip een echte scheiding: het blok valt uiteen in twee blokken
 * met dezelfde titel, zodat het vervolg een eigen tekstveld krijgt en los te
 * bewerken is. Vanaf dat moment bepaalt de aannemer zelf wat waar staat.
 */
export function splitsBlok(block: DocumentBlock, vanaf: Stuk): [DocumentBlock, DocumentBlock] {
  const voor = block.elements.slice(0, vanaf.element).map(duplicateElement);
  const na = block.elements.slice(vanaf.element + 1).map(duplicateElement);
  const element = block.elements[vanaf.element];

  if (!element) return [block, { title: block.title, elements: [] }];

  const knoop = vanaf.van ?? 0;

  // Begint het vervolg bij een heel element, dan hoeft er niets gesneden
  if (element.kind !== 'tekst' || knoop === 0) {
    return [
      { title: block.title, elements: voor },
      { title: block.title, elements: [duplicateElement(element), ...na] },
    ];
  }

  // Een tekst die over twee vellen liep wordt op dezelfde plek twee teksten
  const html = toDisplayHtml(element.body);
  return [
    { title: block.title, elements: [...voor, { ...duplicateElement(element), body: snijTekst(html, 0, knoop) }] },
    { title: block.title, elements: [{ ...duplicateElement(element), body: snijTekst(html, knoop) }, ...na] },
  ];
}
