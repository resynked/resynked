import { ReactNode, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  CopyPlus,
  Heading,
  IdCard,
  ListPlus,
  Percent,
  Pilcrow,
  Plus,
  Signature,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import Modal from '@/components/Modal';
import Select from '@/components/Select';
import FormattingToolbar from '@/components/FormattingToolbar';
import { fieldKeys, type EditTarget } from '@/components/InlineEditing';
import { duplicateElement, emptyElement, emptyHeading, emptyItem } from '@/lib/blocks';
import { verplaats } from '@/lib/sorteren';
import type { DocumentBlock, DocumentElement, ElementKind, LineItem } from '@/lib/supabase';

interface IslandBarProps {
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

const NEW_ELEMENTS: { kind: ElementKind; title: string; icon: typeof Plus }[] = [
  { kind: 'tekst', title: 'Tekst', icon: Pilcrow },
  { kind: 'kop', title: 'Kop', icon: Heading },
  { kind: 'prijstabel', title: 'Prijstabel', icon: Table },
  { kind: 'gegevens', title: 'Gegevens', icon: IdCard },
  { kind: 'handtekening', title: 'Handtekening', icon: Signature },
];

/** Een icoonknop in de balk. Hij pakt de focus niet, zodat de cursor op het papier blijft. */
function ToolButton({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      data-label={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * De balk die onderin opduikt zodra je iets op het papier aanklikt.
 *
 * De tekst zelf typ je op het papier, en de volgorde sleep je daar ook. Hier
 * staat alleen wat daar niet kan: opmaak, iets toevoegen of verwijderen, en de
 * instellingen van een prijstabel. Wat er staat hangt af van wat je gekozen
 * hebt, zodat de balk klein blijft.
 */
export default function IslandBar({
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
}: IslandBarProps) {
  // De knoppen om een element toe te voegen nemen even de plek van de rest in
  const [adding, setAdding] = useState(false);
  const [dialog, setDialog] = useState<'gegevens' | 'prijstabel' | null>(null);

  const elementIndex = selected.element;
  const element = elementIndex !== undefined ? block.elements[elementIndex] : undefined;
  const itemIndex = element?.kind === 'prijstabel' ? selected.item : undefined;

  useEffect(() => setAdding(false), [blockIndex, elementIndex]);

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
    setAdding(false);

    const field = firstField(kind, at);
    if (field) onFocusField(field);
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

  const close = (
    <div className="group">
      <ToolButton title="Sluiten" onClick={onClose}>
        <X size={15} />
      </ToolButton>
    </div>
  );

  const groups = adding ? (
    <div className="group">
      <ToolButton title="Terug" onClick={() => setAdding(false)}>
        <ChevronLeft size={15} />
      </ToolButton>
      {NEW_ELEMENTS.map(({ kind, title, icon: Icon }) => (
        <ToolButton key={kind} title={`${title} toevoegen`} onClick={() => addElement(kind)}>
          <Icon size={15} />
        </ToolButton>
      ))}
    </div>
  ) : (
    <>
      {element?.kind === 'prijstabel' && elementIndex !== undefined && (
        <div className="group">
          <ToolButton title="Regel toevoegen" onClick={() => addItem(emptyItem())}>
            <ListPlus size={15} />
          </ToolButton>
          <ToolButton title="Tussenkop toevoegen" onClick={() => addItem(emptyHeading())}>
            <Heading size={15} />
          </ToolButton>
          <ToolButton title="BTW en korting" onClick={() => setDialog('prijstabel')}>
            <Percent size={15} />
          </ToolButton>
        </div>
      )}

      {element?.kind === 'prijstabel' && itemIndex !== undefined && element.items[itemIndex] && (
        <div className="group">
          <ToolButton title="Regel omhoog" disabled={itemIndex === 0} onClick={() => moveItem(itemIndex, itemIndex - 1)}>
            <ArrowUp size={15} />
          </ToolButton>
          <ToolButton
            title="Regel omlaag"
            disabled={itemIndex === element.items.length - 1}
            onClick={() => moveItem(itemIndex, itemIndex + 1)}
          >
            <ArrowDown size={15} />
          </ToolButton>
          <ToolButton title="Regel verwijderen" onClick={() => removeItem(itemIndex)}>
            <Trash2 size={15} />
          </ToolButton>
        </div>
      )}

      {element?.kind === 'gegevens' && (
        <div className="group">
          <ToolButton title="Klant en gegevens" onClick={() => setDialog('gegevens')}>
            <IdCard size={15} />
          </ToolButton>
        </div>
      )}

      {element && elementIndex !== undefined && (
        <div className="group">
          <ToolButton title="Element dupliceren" onClick={() => copyElement(elementIndex)}>
            <Copy size={15} />
          </ToolButton>
          <ToolButton title="Element verwijderen" onClick={() => removeElement(elementIndex)}>
            <Trash2 size={15} />
          </ToolButton>
        </div>
      )}

      <div className="group">
        <ToolButton title="Element toevoegen" onClick={() => setAdding(true)}>
          <Plus size={15} />
        </ToolButton>
        <ToolButton title="Blok dupliceren" onClick={onDuplicate}>
          <CopyPlus size={15} />
        </ToolButton>
        <ToolButton title="Blok verwijderen" className="delete" onClick={onRemove}>
          <Trash2 size={15} />
        </ToolButton>
      </div>
    </>
  );

  return (
    <>
      <div className="island-bar rich-editor">
        {element?.kind === 'tekst' && !adding ? (
          <FormattingToolbar>
            {groups}
            {close}
          </FormattingToolbar>
        ) : (
          <div className="toolbar">
            {groups}
            {close}
          </div>
        )}
      </div>

      <Modal isOpen={dialog === 'gegevens'} onClose={() => setDialog(null)} title="Klant en gegevens">
        {dataFields}
      </Modal>

      <Modal isOpen={dialog === 'prijstabel'} onClose={() => setDialog(null)} title="BTW en korting">
        {element?.kind === 'prijstabel' && elementIndex !== undefined && (
          <div className="form-section">
            <div className="form-group">
              <label>BTW percentage</label>
              <Select
                value={taxOptions.find(o => o.value === String(element.tax_percentage)) || null}
                onChange={(option) => updateElement(elementIndex, { tax_percentage: Number(option?.value ?? 21) })}
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
        )}
      </Modal>
    </>
  );
}
