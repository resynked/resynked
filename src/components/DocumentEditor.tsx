import { ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import DocumentPreview from '@/components/DocumentPreview';
import BlockEditor from '@/components/BlockEditor';
import { duplicateBlock, emptyBlock } from '@/lib/blocks';
import type { Customer, DocumentBlock } from '@/lib/supabase';

interface DocumentEditorProps {
  title: 'Offerte' | 'Factuur';
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  blocks: DocumentBlock[];
  currency?: string;
  /** Velden die niet in een blok staan, zoals de klant en de datums */
  panels: Record<string, { title: string; content: ReactNode }>;
  /** Welk paneel opengaat bij een klik op het gegevens-element */
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
  panels,
  onBlocksChange,
}: DocumentEditorProps) {
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const close = () => {
    setActiveBlock(null);
    setActivePanel(null);
  };

  const selectBlock = (index: number) => {
    setActivePanel(null);
    setActiveBlock(index);
  };

  // Een nieuw blok opent meteen, zodat je de titel kunt typen
  const addBlock = (atIndex: number) => {
    if (!onBlocksChange) return;

    onBlocksChange([...blocks.slice(0, atIndex), emptyBlock(), ...blocks.slice(atIndex)]);
    selectBlock(atIndex);
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
    selectBlock(index + 1);
  };

  const deleteBlock = (index: number) => {
    onBlocksChange?.(blocks.filter((_, i) => i !== index));
    close();
  };

  const openBlock = activeBlock !== null ? blocks[activeBlock] : null;
  const openPanel = activePanel ? panels[activePanel] : null;

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
            activeBlock={activeBlock}
            onSelectBlock={onBlocksChange ? selectBlock : undefined}
            onAddBlock={onBlocksChange ? addBlock : undefined}
          />
        </div>
      </div>

      {(openBlock || openPanel) && (
        <>
          <div className="editor-panel-overlay" onClick={close} />

          <div className="editor-panel">
            <div className="header">
              <h2>{openBlock ? 'Blok' : openPanel?.title}</h2>
              <button type="button" onClick={close} aria-label="Paneel sluiten">
                <X size={18} />
              </button>
            </div>

            {openBlock && activeBlock !== null ? (
              <>
                <BlockEditor
                  block={openBlock}
                  onChange={(block) => changeBlock(activeBlock, block)}
                  onDuplicate={() => copyBlock(activeBlock)}
                  onRemove={() => deleteBlock(activeBlock)}
                />

                {/* De gegevens in dit blok komen uit velden van het document zelf */}
                {openBlock.elements.some(el => el.kind === 'gegevens') &&
                  Object.entries(panels).map(([key, panel]) => (
                    <div key={key} className="form-section edit-holder">
                      <h3>{panel.title}</h3>
                      {panel.content}
                    </div>
                  ))}
              </>
            ) : (
              openPanel?.content
            )}
          </div>
        </>
      )}
    </>
  );
}
