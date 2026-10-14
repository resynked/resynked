import { ReactNode, useEffect, useState } from 'react';
import DocumentPreview from '@/components/DocumentPreview';
import IslandBar from '@/components/IslandBar';
import { fieldKeys, type EditTarget } from '@/components/InlineEditing';
import { duplicateBlock, emptyBlock } from '@/lib/blocks';
import { splitsBlok, type Stuk } from '@/lib/pagination';
import { verplaats } from '@/lib/sorteren';
import type { SignatureState } from '@/components/DocumentPreview';
import type { Customer, DocumentBlock } from '@/lib/supabase';

interface DocumentEditorProps {
  title: 'Offerte' | 'Factuur';
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  blocks: DocumentBlock[];
  currency?: string;
  /** De handtekening van de klant, zodra die er is */
  signature?: SignatureState | null;
  /** De velden bij een gegevens-element: klant, nummer, datums en valuta */
  dataFields?: ReactNode;
  onBlocksChange?: (blocks: DocumentBlock[]) => void;
}

/**
 * Het document over de volle breedte, en je bewerkt het op het papier zelf:
 * klik in een tekst, kop, titel of regel en typ, of sleep een element naar
 * een andere plek. Zo zie je meteen hoe het eruit komt te zien, en blijf je op
 * de plek waar je mee bezig was.
 *
 * Zodra je iets kiest, duikt onderin een kleine balk op met wat niet op het
 * papier kan: opmaak, toevoegen, verwijderen en de instellingen.
 */
export default function DocumentEditor({
  title,
  meta,
  customer,
  blocks,
  currency,
  signature,
  dataFields,
  onBlocksChange,
}: DocumentEditorProps) {
  const [selected, setSelected] = useState<EditTarget | null>(null);
  // Een veld dat de cursor moet krijgen, zoals de titel van een nieuw blok.
  // Elke keer een nieuw object, zodat dezelfde vraag twee keer kan komen
  const [focusField, setFocusField] = useState<{ field: string } | null>(null);

  const close = () => setSelected(null);
  const focus = (field: string) => setFocusField({ field });

  // Escape stopt met bewerken, zoals bij elk ander venster
  useEffect(() => {
    if (!selected) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      (document.activeElement as HTMLElement | null)?.blur();
      setSelected(null);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selected]);

  // Een nieuw blok krijgt meteen de cursor in zijn titel
  const addBlock = (atIndex: number) => {
    if (!onBlocksChange) return;

    onBlocksChange([...blocks.slice(0, atIndex), emptyBlock(), ...blocks.slice(atIndex)]);
    setSelected({ block: atIndex });
    focus(fieldKeys.title(atIndex));
  };

  const changeBlock = (index: number, block: DocumentBlock) => {
    onBlocksChange?.(blocks.map((b, i) => (i === index ? block : b)));
  };

  const copyBlock = (index: number) => {
    onBlocksChange?.([
      ...blocks.slice(0, index + 1),
      duplicateBlock(blocks[index]),
      ...blocks.slice(index + 1),
    ]);
    setSelected({ block: index + 1 });
  };

  /**
   * Een blok dat over twee vellen liep wordt hier echt twee blokken, geknipt
   * waar het tweede vel begon. Allebei houden ze de titel, dus in het
   * document verandert er niets — maar het vervolg is nu los te bewerken.
   */
  const splitBlock = (index: number, vanaf: Stuk) => {
    if (!onBlocksChange) return;

    const [eerste, tweede] = splitsBlok(blocks[index], vanaf);
    onBlocksChange([...blocks.slice(0, index), eerste, tweede, ...blocks.slice(index + 1)]);
    setSelected({ block: index + 1 });
  };

  /**
   * Een pagina naar een andere plek slepen. De balk blijft bij hetzelfde
   * blok, ook al staat dat nu ergens anders in de rij.
   */
  const moveBlock = (van: number, naar: number) => {
    if (!onBlocksChange) return;

    onBlocksChange(verplaats(blocks, van, naar));

    const volgorde = verplaats(blocks.map((_, i) => i), van, naar);
    setSelected(huidig => (huidig === null ? null : { block: volgorde.indexOf(huidig.block) }));
  };

  /**
   * Een element dat op het papier versleept is. Binnen een blok schuift het
   * de rest op; naar een ander blok verhuist het en komt het op de plek van
   * het element waar je het op losliet.
   */
  const moveElement = (from: EditTarget, to: EditTarget) => {
    if (!onBlocksChange || from.element === undefined || to.element === undefined) return;

    const source = blocks[from.block];
    const element = source?.elements[from.element];
    if (!element) return;

    if (from.block === to.block) {
      onBlocksChange(
        blocks.map((b, i) => (i === from.block ? { ...b, elements: verplaats(b.elements, from.element!, to.element!) } : b))
      );
    } else {
      onBlocksChange(
        blocks.map((b, i) => {
          if (i === from.block) return { ...b, elements: b.elements.filter((_, e) => e !== from.element) };
          if (i === to.block) return { ...b, elements: [...b.elements.slice(0, to.element), element, ...b.elements.slice(to.element)] };
          return b;
        })
      );
    }

    setSelected({ block: to.block, element: to.element });
  };

  const deleteBlock = (index: number) => {
    onBlocksChange?.(blocks.filter((_, i) => i !== index));
    close();
  };

  const openBlock = selected !== null ? blocks[selected.block] : null;

  return (
    <>
      <div className="grid">
        <div className="block">
          <DocumentPreview
            title={title}
            meta={meta}
            customer={customer}
            blocks={blocks}
            currency={currency}
            signature={signature}
            selected={selected}
            onSelect={onBlocksChange ? setSelected : undefined}
            onChangeBlock={onBlocksChange ? changeBlock : undefined}
            focusField={focusField}
            onMoveElement={onBlocksChange ? moveElement : undefined}
            onAddBlock={onBlocksChange ? addBlock : undefined}
            onSplitBlock={onBlocksChange ? splitBlock : undefined}
            onMoveBlock={onBlocksChange ? moveBlock : undefined}
          />
        </div>
      </div>

      {openBlock && selected && (
        <IslandBar
          block={openBlock}
          blockIndex={selected.block}
          selected={selected}
          onChange={(block) => changeBlock(selected.block, block)}
          onSelect={setSelected}
          onFocusField={focus}
          onDuplicate={() => copyBlock(selected.block)}
          onRemove={() => deleteBlock(selected.block)}
          onClose={close}
          dataFields={dataFields}
        />
      )}
    </>
  );
}
