import { ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import DocumentPreview, { SLOT_PANELS } from '@/components/DocumentPreview';
import BlockEditor from '@/components/BlockEditor';
import { duplicateBlock, emptyBlock, emptyTextBlock } from '@/lib/blocks';
import type { BlockKind, Customer, DocumentBlock } from '@/lib/supabase';

interface DocumentEditorProps {
  title: 'Offerte' | 'Factuur';
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  blocks: DocumentBlock[];
  currency?: string;
  introText?: string;
  notes?: string;
  /** De velden per onderdeel, met dezelfde sleutels als SLOT_PANELS */
  panels: Record<string, { title: string; content: ReactNode }>;
  /** Zet de blokken opnieuw, als er vanuit het document een blok bijkomt */
  onBlocksChange?: (blocks: DocumentBlock[]) => void;
}

/**
 * Toont het document over de volle breedte. Klik je op een onderdeel, dan
 * schuift links het paneel open met alleen de velden die daarbij horen —
 * zo staat niet het hele formulier tegelijk op het scherm.
 */
export default function DocumentEditor({
  title,
  meta,
  customer,
  blocks,
  currency,
  introText,
  notes,
  panels,
  onBlocksChange,
}: DocumentEditorProps) {
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);

  const panelKey = activeSlot ? SLOT_PANELS[activeSlot] : null;
  const panel = panelKey ? panels[panelKey] : null;

  const close = () => {
    setActiveSlot(null);
    setActiveBlock(null);
  };

  const selectSlot = (slot: string) => {
    setActiveBlock(null);
    setActiveSlot(slot);
  };

  const selectBlock = (index: number) => {
    setActiveSlot(null);
    setActiveBlock(index);
  };

  // Een blok toevoegen opent meteen het paneel, zodat je er direct in kunt typen
  const addBlock = (kind: BlockKind, atIndex: number) => {
    if (!onBlocksChange) return;

    const nieuw = kind === 'tekst' ? emptyTextBlock() : emptyBlock();
    onBlocksChange([...blocks.slice(0, atIndex), nieuw, ...blocks.slice(atIndex)]);
    selectBlock(atIndex);
  };

  const changeBlock = (index: number, block: DocumentBlock) => {
    onBlocksChange?.(blocks.map((b, i) => (i === index ? block : b)));
  };

  const copyBlock = (index: number) => {
    const copy = duplicateBlock(blocks[index]);
    onBlocksChange?.([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
    selectBlock(index + 1);
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
            introText={introText}
            notes={notes}
            activeSlot={activeSlot}
            onSelect={selectSlot}
            activeBlock={activeBlock}
            onSelectBlock={onBlocksChange ? selectBlock : undefined}
            onAddBlock={onBlocksChange ? addBlock : undefined}
          />
        </div>
      </div>

      {(panel || openBlock) && (
        <>
          <div className="editor-panel-overlay" onClick={close} />

          <div className="editor-panel">
            <div className="header">
              <h2>{openBlock ? 'Blok' : panel?.title}</h2>
              <button type="button" onClick={close} aria-label="Paneel sluiten">
                <X size={18} />
              </button>
            </div>

            {openBlock && activeBlock !== null ? (
              <BlockEditor
                block={openBlock}
                onChange={(block) => changeBlock(activeBlock, block)}
                onDuplicate={() => copyBlock(activeBlock)}
                onRemove={() => deleteBlock(activeBlock)}
              />
            ) : (
              panel?.content
            )}
          </div>
        </>
      )}
    </>
  );
}
