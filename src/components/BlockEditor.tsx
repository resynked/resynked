import Link from 'next/link';
import { X, Copy } from 'lucide-react';
import Select from '@/components/Select';
import { UNITS } from '@/lib/constants';
import { emptyHeading, emptyItem } from '@/lib/blocks';
import type { BlockKind, DocumentBlock, LineItem } from '@/lib/supabase';

interface BlockEditorProps {
  block: DocumentBlock;
  onChange: (block: DocumentBlock) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const kindOptions = [
  { value: 'tekst', label: 'Tekst' },
  { value: 'prijsopgave', label: 'Prijstabel' },
];

const unitOptions = [
  { value: '', label: 'Geen' },
  ...UNITS.map(unit => ({ value: unit, label: unit })),
];

const taxOptions = [
  { value: '0', label: '0%' },
  { value: '9', label: '9%' },
  { value: '21', label: '21%' },
];

const discountOptions = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

/**
 * Eén blok van een offerte of factuur. Elk blok heeft een eigen titel en is
 * ofwel vrije tekst ofwel een prijstabel met een eigen BTW-tarief — dat kiest
 * de gebruiker per blok.
 */
export default function BlockEditor({ block, onChange, onDuplicate, onRemove }: BlockEditorProps) {
  const update = (changes: Partial<DocumentBlock>) => onChange({ ...block, ...changes });

  const updateItem = (index: number, changes: Partial<LineItem>) => {
    update({ items: block.items.map((item, i) => (i === index ? { ...item, ...changes } : item)) });
  };

  const addItem = (item: LineItem) => update({ items: [...block.items, item] });

  const removeItem = (index: number) => {
    update({ items: block.items.filter((_, i) => i !== index) });
  };

  // Bij het wisselen van soort blijft de andere inhoud staan, zodat je
  // niet alles kwijt bent als je per ongeluk het verkeerde kiest
  const changeKind = (kind: BlockKind) => {
    update({
      kind,
      items: kind === 'prijsopgave' && block.items.length === 0 ? [emptyItem()] : block.items,
    });
  };

  return (
    <>
      <div className="form-section">
        <div className="form-group">
          <label htmlFor="block_title">Titel</label>
          <input
            id="block_title"
            type="text"
            value={block.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Bijvoorbeeld Werkzaamheden of Prijsopgave"
          />
        </div>

        <div className="form-group">
          <label>Soort</label>
          <Select
            value={kindOptions.find(o => o.value === block.kind) || null}
            onChange={(option) => changeKind((option?.value as BlockKind) || 'tekst')}
            options={kindOptions}
          />
        </div>
      </div>

      {block.kind === 'tekst' ? (
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="block_body">Tekst</label>
            <textarea
              id="block_body"
              value={block.body || ''}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={'Begin met een korte inleiding.\n\n## Dakwerkzaamheden\n- Het demonteren van de nokvorsten\n- Het reinigen van alle nokvorsten'}
              rows={16}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label>BTW percentage</label>
                <Select
                  value={taxOptions.find(o => o.value === String(block.tax_percentage)) || null}
                  onChange={(option) => update({ tax_percentage: Number(option?.value ?? 21) })}
                  options={taxOptions}
                />
              </div>

              <div className="form-group">
                <label>Kortingspercentage</label>
                <Select
                  value={discountOptions.find(o => o.value === String(block.discount_percentage)) || null}
                  onChange={(option) => update({ discount_percentage: Number(option?.value ?? 0) })}
                  options={discountOptions}
                />
              </div>
            </div>
          </div>

          {block.items.map((item, index) =>
            item.is_heading ? (
              <div key={index} className="form-section">
                <div className="form-row invoice-product-line">
                  <div className="form-group">
                    <label>Tussenkop</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Dakwerkzaamheden"
                    />
                  </div>

                  <Link
                    className="action delete"
                    href=""
                    onClick={(e) => {
                      e.preventDefault();
                      removeItem(index);
                    }}
                  >
                    <X size={16} />
                  </Link>
                </div>
              </div>
            ) : (
              <div key={index} className="form-section edit-holder">
                <div className="form-row invoice-product-line">
                  <div className="form-group">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Omschrijving"
                    />
                  </div>

                  <div className="form-group">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, { price: parseFloat(e.target.value) || 0 })}
                      placeholder="Bedrag"
                      className="center-input"
                    />
                  </div>

                  <Link
                    className="action delete"
                    href=""
                    onClick={(e) => {
                      e.preventDefault();
                      removeItem(index);
                    }}
                  >
                    <X size={16} />
                  </Link>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Aantal</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      className="center-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Eenheid</label>
                    <Select
                      value={unitOptions.find(o => o.value === (item.unit || '')) || null}
                      onChange={(option) => updateItem(index, { unit: option?.value || null })}
                      options={unitOptions}
                      placeholder="Geen"
                    />
                  </div>
                </div>
              </div>
            )
          )}

          <div className="form-row">
            <button type="button" className="button add-item" onClick={() => addItem(emptyItem())}>
              + Regel
            </button>

            <button type="button" className="button add-item" onClick={() => addItem(emptyHeading())}>
              + Tussenkop
            </button>
          </div>
        </>
      )}

      <div className="form-section">
        <div className="form-row">
          <button type="button" className="button cancel" onClick={onDuplicate}>
            <Copy size={14} /> Dupliceren
          </button>

          <button type="button" className="button negative" onClick={onRemove}>
            Verwijderen
          </button>
        </div>
      </div>
    </>
  );
}
