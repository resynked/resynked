import { ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import DocumentPreview, { SLOT_PANELS } from '@/components/DocumentPreview';
import { emptyBlock, emptyTextBlock } from '@/lib/blocks';
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

  const panelKey = activeSlot ? SLOT_PANELS[activeSlot] : null;
  const panel = panelKey ? panels[panelKey] : null;

  const close = () => setActiveSlot(null);

  // Een blok toevoegen vanuit het document opent meteen het paneel,
  // zodat je er direct in kunt typen
  const addBlock = (kind: BlockKind) => {
    if (!onBlocksChange) return;
    onBlocksChange([...blocks, kind === 'tekst' ? emptyTextBlock() : emptyBlock()]);
    setActiveSlot('blokken');
  };

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
            onSelect={setActiveSlot}
            onAddBlock={onBlocksChange ? addBlock : undefined}
          />
        </div>
      </div>

      {panel && (
        <>
          <div className="editor-panel-overlay" onClick={close} />

          <div className="editor-panel">
            <div className="header">
              <h2>{panel.title}</h2>
              <button type="button" onClick={close} aria-label="Paneel sluiten">
                <X size={18} />
              </button>
            </div>

            {panel.content}
          </div>
        </>
      )}
    </>
  );
}
