import type { DocumentBlock, LineItem } from './supabase';

/** Een verse prijsregel. */
export const emptyItem = (): LineItem => ({
  description: '',
  is_heading: false,
  quantity: 1,
  unit: null,
  price: 0,
});

/** Een verse tussenkop, bijvoorbeeld "Dakwerkzaamheden". */
export const emptyHeading = (): LineItem => ({
  description: '',
  is_heading: true,
  quantity: 0,
  unit: null,
  price: 0,
});

/** Een vers prijsblok met één lege regel erin. */
export const emptyBlock = (taxPercentage = 21): DocumentBlock => ({
  title: '',
  kind: 'prijsopgave',
  body: null,
  tax_percentage: taxPercentage,
  discount_percentage: 0,
  items: [emptyItem()],
});

/** Een vers tekstblok, voor bijvoorbeeld de omschrijving van de werkzaamheden. */
export const emptyTextBlock = (): DocumentBlock => ({
  title: 'Werkzaamheden',
  kind: 'tekst',
  body: '',
  tax_percentage: 0,
  discount_percentage: 0,
  items: [],
});

/** Maakt een kopie van één blok, inclusief alle regels. */
export function duplicateBlock(block: DocumentBlock): DocumentBlock {
  return {
    title: block.title,
    kind: block.kind,
    body: block.body,
    tax_percentage: block.tax_percentage,
    discount_percentage: block.discount_percentage,
    items: block.items.map(item => ({ ...item, id: undefined })),
  };
}

/**
 * Maakt van opgehaalde blokken een schone kopie zonder database-ids,
 * zodat ze als nieuw document opgeslagen kunnen worden.
 */
export function copyBlocks(blocks: any[] | null | undefined): DocumentBlock[] {
  return (blocks || []).map((block: any) => ({
    title: block.title || '',
    kind: block.kind === 'tekst' ? 'tekst' : 'prijsopgave',
    body: block.body || null,
    tax_percentage: Number(block.tax_percentage) || 0,
    discount_percentage: Number(block.discount_percentage) || 0,
    items: (block.items || []).map((item: any) => ({
      description: item.description || '',
      is_heading: !!item.is_heading,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || null,
      price: Number(item.price) || 0,
    })),
  }));
}

/**
 * Controleert de blokken zoals ze binnenkomen. Geeft een leesbare melding
 * terug bij een probleem, of null als alles klopt. Wordt zowel door de API
 * als door de schermen gebruikt, zodat de melding overal gelijk is.
 */
export function validateBlocks(blocks: unknown): string | null {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return 'Voeg minimaal één blok toe';
  }

  const priceBlocks = blocks.filter((block: any) => block?.kind !== 'tekst');

  if (priceBlocks.length === 0) {
    return 'Voeg minimaal één blok met bedragen toe';
  }

  for (const block of priceBlocks) {
    const items = Array.isArray(block.items) ? block.items : [];

    if (items.filter((item: any) => !item.is_heading).length === 0) {
      return `Blok "${block.title || 'zonder naam'}" heeft nog geen regels`;
    }

    if (items.some((item: any) => !item.description?.trim())) {
      return `Elke regel in "${block.title || 'zonder naam'}" heeft een omschrijving nodig`;
    }
  }

  return null;
}
