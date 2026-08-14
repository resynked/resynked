import Link from 'next/link';
import { X } from 'lucide-react';
import Select from '@/components/Select';
import { UNITS } from '@/lib/constants';
import { emptyBlock, emptyHeading, emptyItem, emptyTextBlock } from '@/lib/blocks';
import type { DocumentBlock, LineItem } from '@/lib/supabase';

interface DocumentBlocksProps {
  blocks: DocumentBlock[];
  onChange: (blocks: DocumentBlock[]) => void;
}

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
 * De blokken van een offerte of factuur. Een prijsblok heeft een eigen
 * BTW-tarief met een eigen subtotaal, zodat bijvoorbeeld 9% schilderwerk en
 * 21% overig werk naast elkaar in dezelfde offerte staan. Een tekstblok is
 * een vrij verhaal, bijvoorbeeld de omschrijving van de werkzaamheden.
 */
export default function DocumentBlocks({ blocks, onChange }: DocumentBlocksProps) {
  const updateBlock = (index: number, changes: Partial<DocumentBlock>) => {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...changes } : block)));
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const updateItem = (blockIndex: number, itemIndex: number, changes: Partial<LineItem>) => {
    const block = blocks[blockIndex];
    updateBlock(blockIndex, {
      items: block.items.map((item, i) => (i === itemIndex ? { ...item, ...changes } : item)),
    });
  };

  const addItem = (blockIndex: number, item: LineItem) => {
    updateBlock(blockIndex, { items: [...blocks[blockIndex].items, item] });
  };

  const removeItem = (blockIndex: number, itemIndex: number) => {
    updateBlock(blockIndex, {
      items: blocks[blockIndex].items.filter((_, i) => i !== itemIndex),
    });
  };

  return (
    <>
      {blocks.map((block, blockIndex) => {
        return (
          <div key={blockIndex} className="form-section edit-holder">
            <div className="form-row invoice-product-line">
              <div className="form-group">
                <label>Naam van het blok</label>
                <input
                  type="text"
                  value={block.title}
                  onChange={(e) => updateBlock(blockIndex, { title: e.target.value })}
                  placeholder={block.kind === 'tekst' ? 'Werkzaamheden' : 'Schilderwerk en stucwerk'}
                />
              </div>

              <Link
                className="action delete"
                href=""
                onClick={(e) => {
                  e.preventDefault();
                  removeBlock(blockIndex);
                }}
              >
                <X size={16} />
              </Link>
            </div>

            {block.kind === 'tekst' ? (
              <div className="form-group">
                <label>Tekst</label>
                <textarea
                  value={block.body || ''}
                  onChange={(e) => updateBlock(blockIndex, { body: e.target.value })}
                  placeholder={'Begin met een korte inleiding.\n\n## Dakwerkzaamheden\n- Het demonteren van de nokvorsten\n- Het reinigen van alle nokvorsten'}
                  rows={12}
                />
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>BTW percentage</label>
                    <Select
                      value={taxOptions.find(o => o.value === String(block.tax_percentage)) || null}
                      onChange={(option) =>
                        updateBlock(blockIndex, { tax_percentage: Number(option?.value ?? 21) })
                      }
                      options={taxOptions}
                    />
                  </div>

                  <div className="form-group">
                    <label>Kortingspercentage</label>
                    <Select
                      value={discountOptions.find(o => o.value === String(block.discount_percentage)) || null}
                      onChange={(option) =>
                        updateBlock(blockIndex, { discount_percentage: Number(option?.value ?? 0) })
                      }
                      options={discountOptions}
                    />
                  </div>
                </div>

                {block.items.map((item, itemIndex) =>
                  item.is_heading ? (
                    <div key={itemIndex} className="form-row invoice-product-line">
                      <div className="form-group">
                        <label>Tussenkop</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(blockIndex, itemIndex, { description: e.target.value })}
                          placeholder="Dakwerkzaamheden"
                        />
                      </div>

                      <Link
                        className="action delete"
                        href=""
                        onClick={(e) => {
                          e.preventDefault();
                          removeItem(blockIndex, itemIndex);
                        }}
                      >
                        <X size={16} />
                      </Link>
                    </div>
                  ) : (
                    <div key={itemIndex} className="form-section">
                      <div className="form-row invoice-product-line">
                        <div className="form-group">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(blockIndex, itemIndex, { description: e.target.value })}
                            placeholder="Omschrijving"
                          />
                        </div>

                        <div className="form-group">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              updateItem(blockIndex, itemIndex, { price: parseFloat(e.target.value) || 0 })
                            }
                            placeholder="Bedrag"
                            className="center-input"
                          />
                        </div>

                        <Link
                          className="action delete"
                          href=""
                          onClick={(e) => {
                            e.preventDefault();
                            removeItem(blockIndex, itemIndex);
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
                            onChange={(e) =>
                              updateItem(blockIndex, itemIndex, { quantity: parseFloat(e.target.value) || 0 })
                            }
                            className="center-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>Eenheid</label>
                          <Select
                            value={unitOptions.find(o => o.value === (item.unit || '')) || null}
                            onChange={(option) =>
                              updateItem(blockIndex, itemIndex, { unit: option?.value || null })
                            }
                            options={unitOptions}
                            placeholder="Geen"
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}

                <div className="form-row">
                  <button
                    type="button"
                    className="button add-item"
                    onClick={() => addItem(blockIndex, emptyItem())}
                  >
                    + Regel toevoegen
                  </button>

                  <button
                    type="button"
                    className="button add-item"
                    onClick={() => addItem(blockIndex, emptyHeading())}
                  >
                    + Tussenkop toevoegen
                  </button>
                </div>

              </>
            )}
          </div>
        );
      })}

      <div className="form-row">
        <button
          type="button"
          className="button add-item"
          onClick={() => onChange([...blocks, emptyBlock()])}
        >
          + Blok met bedragen
        </button>

        <button
          type="button"
          className="button add-item"
          onClick={() => onChange([...blocks, emptyTextBlock()])}
        >
          + Tekstblok
        </button>
      </div>
    </>
  );
}
