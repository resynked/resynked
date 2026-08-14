import { ReactNode } from 'react';
import Link from 'next/link';
import { X, Copy } from 'lucide-react';
import Select from '@/components/Select';
import { UNITS } from '@/lib/constants';
import { duplicateElement, emptyElement, emptyHeading, emptyItem } from '@/lib/blocks';
import type { DocumentBlock, DocumentElement, ElementKind, LineItem } from '@/lib/supabase';

interface BlockEditorProps {
  block: DocumentBlock;
  onChange: (block: DocumentBlock) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** De velden die bij het gegevens-element horen: klant, nummer en datums */
  dataFields?: ReactNode;
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

const ELEMENT_NAMEN: Record<ElementKind, string> = {
  gegevens: 'Gegevens',
  kop: 'Kop',
  tekst: 'Tekst',
  prijstabel: 'Prijstabel',
};

/**
 * Eén blok is één pagina van het document. Het heeft een titel — die komt in
 * het sjabloon op zijn kant in de zijbalk — en daarin zet je elementen:
 * de gegevens, een stuk tekst of een prijstabel, zoveel als je wilt.
 */
export default function BlockEditor({ block, onChange, onDuplicate, onRemove, dataFields }: BlockEditorProps) {
  const updateElement = (index: number, changes: Partial<DocumentElement>) => {
    onChange({
      ...block,
      elements: block.elements.map((el, i) => (i === index ? { ...el, ...changes } : el)),
    });
  };

  const addElement = (kind: ElementKind) => {
    onChange({ ...block, elements: [...block.elements, emptyElement(kind)] });
  };

  const removeElement = (index: number) => {
    onChange({ ...block, elements: block.elements.filter((_, i) => i !== index) });
  };

  const copyElement = (index: number) => {
    const copy = duplicateElement(block.elements[index]);
    onChange({
      ...block,
      elements: [...block.elements.slice(0, index + 1), copy, ...block.elements.slice(index + 1)],
    });
  };

  const updateItem = (elementIndex: number, itemIndex: number, changes: Partial<LineItem>) => {
    const element = block.elements[elementIndex];
    updateElement(elementIndex, {
      items: element.items.map((item, i) => (i === itemIndex ? { ...item, ...changes } : item)),
    });
  };

  const addItem = (elementIndex: number, item: LineItem) => {
    updateElement(elementIndex, { items: [...block.elements[elementIndex].items, item] });
  };

  const removeItem = (elementIndex: number, itemIndex: number) => {
    updateElement(elementIndex, {
      items: block.elements[elementIndex].items.filter((_, i) => i !== itemIndex),
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
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Vul een titel in"
          />
        </div>
      </div>

      {block.elements.map((element, elementIndex) => (
        <div key={elementIndex} className="form-section edit-holder">
          <div className="form-row invoice-product-line">
            <div className="form-group">
              <label>{ELEMENT_NAMEN[element.kind]}</label>
            </div>

            <Link
              className="action copy"
              href=""
              title="Dupliceren"
              onClick={(e) => {
                e.preventDefault();
                copyElement(elementIndex);
              }}
            >
              <Copy size={16} />
            </Link>

            <Link
              className="action delete"
              href=""
              title="Verwijderen"
              onClick={(e) => {
                e.preventDefault();
                removeElement(elementIndex);
              }}
            >
              <X size={16} />
            </Link>
          </div>

          {element.kind === 'gegevens' && dataFields}

          {element.kind === 'kop' && (
            <div className="form-group">
              <input
                type="text"
                value={element.body || ''}
                onChange={(e) => updateElement(elementIndex, { body: e.target.value })}
                placeholder="Vul een kop in"
              />
            </div>
          )}

          {element.kind === 'tekst' && (
            <div className="form-group">
              <textarea
                value={element.body || ''}
                onChange={(e) => updateElement(elementIndex, { body: e.target.value })}
                placeholder={'Begin met een korte inleiding.\n\n## Dakwerkzaamheden\n- Het demonteren van de nokvorsten'}
                rows={12}
              />
            </div>
          )}

          {element.kind === 'prijstabel' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>BTW percentage</label>
                  <Select
                    value={taxOptions.find(o => o.value === String(element.tax_percentage)) || null}
                    onChange={(option) =>
                      updateElement(elementIndex, { tax_percentage: Number(option?.value ?? 21) })
                    }
                    options={taxOptions}
                  />
                </div>

                <div className="form-group">
                  <label>Kortingspercentage</label>
                  <Select
                    value={discountOptions.find(o => o.value === String(element.discount_percentage)) || null}
                    onChange={(option) =>
                      updateElement(elementIndex, { discount_percentage: Number(option?.value ?? 0) })
                    }
                    options={discountOptions}
                  />
                </div>
              </div>

              {element.items.map((item, itemIndex) =>
                item.is_heading ? (
                  <div key={itemIndex} className="form-row invoice-product-line">
                    <div className="form-group">
                      <label>Tussenkop</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(elementIndex, itemIndex, { description: e.target.value })}
                        placeholder="Dakwerkzaamheden"
                      />
                    </div>

                    <Link
                      className="action delete"
                      href=""
                      onClick={(e) => {
                        e.preventDefault();
                        removeItem(elementIndex, itemIndex);
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
                          onChange={(e) => updateItem(elementIndex, itemIndex, { description: e.target.value })}
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
                            updateItem(elementIndex, itemIndex, { price: parseFloat(e.target.value) || 0 })
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
                          removeItem(elementIndex, itemIndex);
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
                            updateItem(elementIndex, itemIndex, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          className="center-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Eenheid</label>
                        <Select
                          value={unitOptions.find(o => o.value === (item.unit || '')) || null}
                          onChange={(option) => updateItem(elementIndex, itemIndex, { unit: option?.value || null })}
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
                  onClick={() => addItem(elementIndex, emptyItem())}
                >
                  + Regel
                </button>

                <button
                  type="button"
                  className="button add-item"
                  onClick={() => addItem(elementIndex, emptyHeading())}
                >
                  + Tussenkop
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <div className="form-section">
        <div className="form-row">
          <button type="button" className="button add-item" onClick={() => addElement('prijstabel')}>
            + Prijstabel
          </button>

          <button type="button" className="button add-item" onClick={() => addElement('kop')}>
            + Kop
          </button>

          <button type="button" className="button add-item" onClick={() => addElement('tekst')}>
            + Tekst
          </button>

          <button type="button" className="button add-item" onClick={() => addElement('gegevens')}>
            + Gegevens
          </button>
        </div>
      </div>

      <div className="form-section">
        <div className="form-row">
          <button type="button" className="button cancel" onClick={onDuplicate}>
            Blok dupliceren
          </button>

          <button type="button" className="button negative" onClick={onRemove}>
            Blok verwijderen
          </button>
        </div>
      </div>
    </>
  );
}
