import type { DocumentBlock, DocumentElement, ElementKind, LineItem } from './supabase';

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

/** Een vers element van de gekozen soort. */
export const emptyElement = (kind: ElementKind): DocumentElement => ({
  kind,
  body: kind === 'tekst' ? '' : null,
  tax_percentage: 21,
  discount_percentage: 0,
  items: kind === 'prijstabel' ? [emptyItem()] : [],
});

/** Een vers blok: één pagina met een titel en nog geen elementen. */
export const emptyBlock = (title = ''): DocumentBlock => ({
  title,
  elements: [],
});

/** De blokken waarmee een nieuwe offerte of factuur begint. */
export const startBlocks = (): DocumentBlock[] => [
  { title: 'Offerte', elements: [emptyElement('gegevens')] },
];

/** Maakt een kopie van één element, zonder database-ids. */
export function duplicateElement(element: DocumentElement): DocumentElement {
  return {
    kind: element.kind,
    body: element.body,
    tax_percentage: element.tax_percentage,
    discount_percentage: element.discount_percentage,
    items: element.items.map(item => ({ ...item, id: undefined })),
  };
}

/** Maakt een kopie van een heel blok, inclusief alle elementen. */
export function duplicateBlock(block: DocumentBlock): DocumentBlock {
  return {
    title: block.title,
    elements: block.elements.map(duplicateElement),
  };
}

/**
 * Maakt van opgehaalde blokken een schone kopie zonder database-ids,
 * zodat ze als nieuw document opgeslagen kunnen worden.
 */
export function copyBlocks(blocks: any[] | null | undefined): DocumentBlock[] {
  return (blocks || []).map((block: any) => ({
    title: block.title || '',
    elements: (block.elements || []).map((element: any) => ({
      kind: element.kind || 'tekst',
      body: element.body ?? null,
      tax_percentage: Number(element.tax_percentage) || 0,
      discount_percentage: Number(element.discount_percentage) || 0,
      items: (element.items || []).map((item: any) => ({
        description: item.description || '',
        is_heading: !!item.is_heading,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || null,
        price: Number(item.price) || 0,
      })),
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

  for (const block of blocks) {
    const elements = Array.isArray(block.elements) ? block.elements : [];

    for (const element of elements) {
      if (element.kind !== 'prijstabel') continue;

      const items = Array.isArray(element.items) ? element.items : [];

      if (items.filter((item: any) => !item.is_heading).length === 0) {
        return `De prijstabel in "${block.title || 'zonder naam'}" heeft nog geen regels`;
      }

      if (items.some((item: any) => !item.description?.trim())) {
        return `Elke regel in "${block.title || 'zonder naam'}" heeft een omschrijving nodig`;
      }
    }
  }

  return null;
}
