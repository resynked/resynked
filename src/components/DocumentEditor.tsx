import { ReactNode, useState } from 'react';
import DocumentPreview from '@/components/DocumentPreview';
import SidePanel from '@/components/SidePanel';
import BlockEditor from '@/components/BlockEditor';
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
 * Toont het document over de volle breedte. Klik je op een blok, dan schuift
 * rechts het paneel open met de titel van dat blok en de elementen erin —
 * zo staat niet het hele formulier tegelijk op het scherm.
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
  const [activeBlock, setActiveBlock] = useState<number | null>(null);

  const close = () => setActiveBlock(null);

  // Een nieuw blok opent meteen, zodat je de titel kunt typen
  const addBlock = (atIndex: number) => {
    if (!onBlocksChange) return;

    onBlocksChange([...blocks.slice(0, atIndex), emptyBlock(), ...blocks.slice(atIndex)]);
    setActiveBlock(atIndex);
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
    setActiveBlock(index + 1);
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
    setActiveBlock(index + 1);
  };

  /**
   * Een pagina naar een andere plek slepen. Het paneel blijft bij hetzelfde
   * blok openstaan, ook al staat dat nu ergens anders in de rij.
   */
  const moveBlock = (van: number, naar: number) => {
    if (!onBlocksChange) return;

    onBlocksChange(verplaats(blocks, van, naar));

    const volgorde = verplaats(blocks.map((_, i) => i), van, naar);
    setActiveBlock(huidig => (huidig === null ? null : volgorde.indexOf(huidig)));
  };

  const deleteBlock = (index: number) => {
    onBlocksChange?.(blocks.filter((_, i) => i !== index));
    close();
  };

  const openBlock = activeBlock !== null ? blocks[activeBlock] : null;

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
            activeBlock={activeBlock}
            onSelectBlock={onBlocksChange ? setActiveBlock : undefined}
            onAddBlock={onBlocksChange ? addBlock : undefined}
            onSplitBlock={onBlocksChange ? splitBlock : undefined}
            onMoveBlock={onBlocksChange ? moveBlock : undefined}
          />
        </div>
      </div>

      {openBlock && activeBlock !== null && (
        <SidePanel title="Blok" onClose={close}>
          <BlockEditor
            block={openBlock}
            onChange={(block) => changeBlock(activeBlock, block)}
            onDuplicate={() => copyBlock(activeBlock)}
            onRemove={() => deleteBlock(activeBlock)}
            dataFields={dataFields}
          />
        </SidePanel>
      )}
    </>
  );
}
