import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import Select from '@/components/Select';
import FormattingToolbar from '@/components/FormattingToolbar';
import { fieldKeys, type EditTarget } from '@/components/InlineEditing';
import { duplicateElement, emptyElement, emptyHeading, emptyItem } from '@/lib/blocks';
import { verplaats } from '@/lib/sorteren';
import type { DocumentBlock, DocumentElement, ElementKind, LineItem } from '@/lib/supabase';

interface BlockEditorProps {
  block: DocumentBlock;
  blockIndex: number;
  /** Het element en de regel die op het papier gekozen zijn */
  selected: EditTarget;
  onChange: (block: DocumentBlock) => void;
  onSelect: (target: EditTarget) => void;
  /** Zet de cursor in een veld op het papier, zoals een kop die net is toegevoegd */
  onFocusField: (field: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
  /** De velden die bij het gegevens-element horen: klant, nummer en datums */
  dataFields?: ReactNode;
}

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

const ELEMENT_NAMES: Record<ElementKind, string> = {
  gegevens: 'Gegevens',
  kop: 'Kop',
  tekst: 'Tekst',
  prijstabel: 'Prijstabel',
  handtekening: 'Handtekening',
};

/** Een knopje met een icoon, zoals de acties in de rest van de app. */
function IconAction({
  className = 'action',
  title,
  onClick,
  disabled,
  children,
}: {
  className?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      className={className}
      href=""
      title={title}
      aria-label={title}
      aria-disabled={disabled || undefined}
      // Zo blijft de cursor op het papier staan
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        if (!disabled) onClick();
      }}
    >
      {children}
    </Link>
  );
}

/**
 * De balk boven het papier voor het blok waar je mee bezig bent.
 *
 * De tekst zelf typ je op het papier. Hier staat wat daar niet past: elementen
 * toevoegen en verplaatsen, de opmaakknoppen bij een tekst, btw en korting bij
 * een prijstabel, en de klant en datums bij de gegevens. Wat er staat hangt af
 * van waar je op het papier geklikt hebt.
 */
export default function BlockEditor({
  block,
  blockIndex,
  selected,
  onChange,
  onSelect,
  onFocusField,
  onDuplicate,
  onRemove,
  onClose,
  dataFields,
}: BlockEditorProps) {
  const elementIndex = selected.element;
  const element = elementIndex !== undefined ? block.elements[elementIndex] : undefined;
  const itemIndex = element?.kind === 'prijstabel' ? selected.item : undefined;

  const setElements = (elements: DocumentElement[]) => onChange({ ...block, elements });

  const updateElement = (index: number, changes: Partial<DocumentElement>) => {
    setElements(block.elements.map((el, i) => (i === index ? { ...el, ...changes } : el)));
  };

  /** Het eerste veld van een element, om meteen in te kunnen typen. */
  const firstField = (kind: ElementKind, index: number) => {
    if (kind === 'kop') return fieldKeys.heading(blockIndex, index);
    if (kind === 'tekst') return fieldKeys.text(blockIndex, index);
    if (kind === 'prijstabel') return fieldKeys.description(blockIndex, index, 0);
    return null;
  };

  // Een nieuw element komt onder het gekozen element, of anders onderaan
  const addElement = (kind: ElementKind) => {
    const at = elementIndex !== undefined ? elementIndex + 1 : block.elements.length;
    setElements([...block.elements.slice(0, at), emptyElement(kind), ...block.elements.slice(at)]);
    onSelect({ block: blockIndex, element: at });

    const field = firstField(kind, at);
    if (field) onFocusField(field);
  };

  const moveElement = (from: number, to: number) => {
    if (to < 0 || to >= block.elements.length) return;
    setElements(verplaats(block.elements, from, to));
    onSelect({ block: blockIndex, element: to });
  };

  const copyElement = (index: number) => {
    setElements([
      ...block.elements.slice(0, index + 1),
      duplicateElement(block.elements[index]),
      ...block.elements.slice(index + 1),
    ]);
    onSelect({ block: blockIndex, element: index + 1 });
  };

  const removeElement = (index: number) => {
    setElements(block.elements.filter((_, i) => i !== index));
    onSelect({ block: blockIndex });
  };

  const setItems = (items: LineItem[]) => {
    if (elementIndex !== undefined) updateElement(elementIndex, { items });
  };

  const addItem = (item: LineItem) => {
    if (!element || elementIndex === undefined) return;

    // Onder de gekozen regel, of anders onderaan de tabel
    const at = itemIndex !== undefined ? itemIndex + 1 : element.items.length;
    setItems([...element.items.slice(0, at), item, ...element.items.slice(at)]);
    onSelect({ block: blockIndex, element: elementIndex, item: at });
    onFocusField(fieldKeys.description(blockIndex, elementIndex, at));
  };

  const moveItem = (from: number, to: number) => {
    if (!element || elementIndex === undefined || to < 0 || to >= element.items.length) return;
    setItems(verplaats(element.items, from, to));
    onSelect({ block: blockIndex, element: elementIndex, item: to });
  };

  const removeItem = (index: number) => {
    if (!element || elementIndex === undefined) return;
    setItems(element.items.filter((_, i) => i !== index));
    onSelect({ block: blockIndex, element: elementIndex });
  };

  return (
    <>
      <div className="form-section">
        <div className="form-row">
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
          <button type="button" className="button add-item" onClick={() => addElement('handtekening')}>
            + Handtekening
          </button>
          <button type="button" className="button cancel" onClick={onDuplicate}>
            Blok dupliceren
          </button>
          <button type="button" className="button negative" onClick={onRemove}>
            Blok verwijderen
          </button>
          <button type="button" className="button cancel" onClick={onClose}>
            Klaar
          </button>
        </div>
      </div>

      {element && elementIndex !== undefined && (
        <div className="form-section edit-holder">
          <div className="form-row">
            <div className="form-group">
              <label>{ELEMENT_NAMES[element.kind]}</label>
            </div>

            <IconAction
              title="Omhoog"
              disabled={elementIndex === 0}
              onClick={() => moveElement(elementIndex, elementIndex - 1)}
            >
              <ArrowUp size={16} />
            </IconAction>
            <IconAction
              title="Omlaag"
              disabled={elementIndex === block.elements.length - 1}
              onClick={() => moveElement(elementIndex, elementIndex + 1)}
            >
              <ArrowDown size={16} />
            </IconAction>
            <IconAction className="action copy" title="Dupliceren" onClick={() => copyElement(elementIndex)}>
              <Copy size={16} />
            </IconAction>
            <IconAction className="action delete" title="Verwijderen" onClick={() => removeElement(elementIndex)}>
              <Trash2 size={16} />
            </IconAction>
          </div>

          {element.kind === 'tekst' && (
            <div className="rich-editor">
              <FormattingToolbar />
            </div>
          )}

          {element.kind === 'gegevens' && dataFields}

          {element.kind === 'handtekening' && (
            <p className="field-note">
              Hier tekent de klant op zijn eigen offertepagina. Zolang er niet getekend
              is staan hier de lijnen voor plaats, datum en handtekening; daarna staat
              de handtekening zelf op deze plek.
            </p>
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

              <div className="form-row">
                <button type="button" className="button add-item" onClick={() => addItem(emptyItem())}>
                  + Regel
                </button>
                <button type="button" className="button add-item" onClick={() => addItem(emptyHeading())}>
                  + Tussenkop
                </button>
              </div>

              {itemIndex !== undefined && element.items[itemIndex] && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{element.items[itemIndex].is_heading ? 'Tussenkop' : 'Regel'} {itemIndex + 1}</label>
                  </div>

                  <IconAction
                    title="Regel omhoog"
                    disabled={itemIndex === 0}
                    onClick={() => moveItem(itemIndex, itemIndex - 1)}
                  >
                    <ArrowUp size={16} />
                  </IconAction>
                  <IconAction
                    title="Regel omlaag"
                    disabled={itemIndex === element.items.length - 1}
                    onClick={() => moveItem(itemIndex, itemIndex + 1)}
                  >
                    <ArrowDown size={16} />
                  </IconAction>
                  <IconAction className="action delete" title="Regel verwijderen" onClick={() => removeItem(itemIndex)}>
                    <Trash2 size={16} />
                  </IconAction>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
