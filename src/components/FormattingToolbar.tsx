import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  RemoveFormatting,
  X,
} from 'lucide-react';

/**
 * De knoppen in de balk. Een blok-knop zet de hele alinea om, een opmaak-knop
 * werkt op de selectie. `state` is wat de browser als aan of uit meldt.
 */
export type ToolbarButton = {
  command: string;
  value?: string;
  icon: typeof Bold;
  title: string;
  /** Waarmee gekeken wordt of deze knop nu aan staat */
  state?: { kind: 'inline'; command: string } | { kind: 'block'; tag: string };
};

const GROUPS: ToolbarButton[][] = [
  [
    { command: 'bold', icon: Bold, title: 'Vet', state: { kind: 'inline', command: 'bold' } },
    { command: 'italic', icon: Italic, title: 'Cursief', state: { kind: 'inline', command: 'italic' } },
    { command: 'underline', icon: Underline, title: 'Onderstreept', state: { kind: 'inline', command: 'underline' } },
    {
      command: 'strikeThrough',
      icon: Strikethrough,
      title: 'Doorgehaald',
      state: { kind: 'inline', command: 'strikeThrough' },
    },
  ],
  [
    {
      command: 'formatBlock',
      value: 'h2',
      icon: Heading2,
      title: 'Kop',
      state: { kind: 'block', tag: 'h2' },
    },
    {
      command: 'formatBlock',
      value: 'h3',
      icon: Heading3,
      title: 'Tussenkop',
      state: { kind: 'block', tag: 'h3' },
    },
    {
      command: 'formatBlock',
      value: 'blockquote',
      icon: Quote,
      title: 'Citaat',
      state: { kind: 'block', tag: 'blockquote' },
    },
  ],
  [
    {
      command: 'insertUnorderedList',
      icon: List,
      title: 'Opsomming',
      state: { kind: 'inline', command: 'insertUnorderedList' },
    },
    {
      command: 'insertOrderedList',
      icon: ListOrdered,
      title: 'Genummerde lijst',
      state: { kind: 'inline', command: 'insertOrderedList' },
    },
  ],
  [
    { command: 'removeFormat', icon: RemoveFormatting, title: 'Opmaak weghalen' },
    { command: 'undo', icon: Undo2, title: 'Ongedaan maken' },
    { command: 'redo', icon: Redo2, title: 'Opnieuw' },
  ],
];

/** Een tekstelement op het papier, zoals InlineEditing het neerzet. */
const PAPER_TEXT_FIELD = '[data-bewerk^="tekst:"][contenteditable="true"]';

/** Het tekstveld waar een node in staat, als dat een van de onze is. */
function fieldAround(node: Node | null, getField?: () => HTMLElement | null): HTMLElement | null {
  if (!node) return null;

  if (getField) {
    const field = getField();
    return field && field.contains(node) ? field : null;
  }

  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest<HTMLElement>(PAPER_TEXT_FIELD) ?? null;
}

interface FormattingToolbarProps {
  /**
   * Het veld waar de knoppen op werken. Zonder dit is het het tekstelement op
   * het papier waar de cursor op dat moment in staat.
   */
  getField?: () => HTMLElement | null;
  /** Meer knoppen in dezelfde balk, achter de opmaakknoppen */
  children?: ReactNode;
}

/**
 * De knoppen voor de opmaak van een tekstelement: vet, koppen, lijsten, links.
 *
 * Deze balk werkt op de tekst waar de cursor op dat moment staat: op het
 * papier, of in het veld van de RichTextEditor. Het schrijven laten we aan de
 * browser over via
 * execCommand. Dat is officieel verouderd, maar het werkt in elke browser en
 * het alternatief is de hele selectie- en ongedaanmaak-administratie zelf
 * bijhouden. De browser meldt elke wijziging aan het tekstveld, dat de
 * uitvoer opschoont en bewaart.
 */
export default function FormattingToolbar({ getField, children }: FormattingToolbarProps) {
  const savedRange = useRef<Range | null>(null);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [linkValue, setLinkValue] = useState<string | null>(null);

  /** Leest bij de browser op welke knoppen nu aan staan. */
  const activeField = useCallback(
    () => fieldAround(document.getSelection()?.anchorNode ?? null, getField),
    [getField]
  );

  const refreshStates = useCallback(() => {
    if (!activeField()) return;

    const states: Record<string, boolean> = {};

    GROUPS.flat().forEach((button) => {
      if (!button.state) return;

      if (button.state.kind === 'inline') {
        try {
          states[button.title] = document.queryCommandState(button.state.command);
        } catch {
          states[button.title] = false;
        }
        return;
      }

      try {
        states[button.title] =
          document.queryCommandValue('formatBlock').toLowerCase() === button.state.tag;
      } catch {
        states[button.title] = false;
      }
    });

    setActiveStates(states);
  }, [activeField]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshStates);
    return () => document.removeEventListener('selectionchange', refreshStates);
  }, [refreshStates]);

  const run = (button: ToolbarButton) => {
    // Staat de cursor nog nergens, dan in het eigen veld als dat er is
    if (!activeField()) getField?.()?.focus();
    if (!activeField()) return;

    // Een tweede klik op dezelfde kop zet de alinea weer terug naar gewoon
    const value =
      button.command === 'formatBlock'
        ? activeStates[button.title]
          ? '<p>'
          : `<${button.value}>`
        : undefined;

    document.execCommand(button.command, false, value);
    refreshStates();
  };

  /** Bewaart waar de cursor staat, want die gaat verloren zodra je in het invoerveld klikt. */
  const openLinkField = () => {
    const selection = document.getSelection();
    savedRange.current =
      activeField() && selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    setLinkValue('');
  };

  const restoreSelection = () => {
    const range = savedRange.current;
    const selection = document.getSelection();
    if (!range || !selection) return null;

    const field = fieldAround(range.startContainer, getField);
    field?.focus({ preventScroll: true });

    selection.removeAllRanges();
    selection.addRange(range);
    return field ?? null;
  };

  const applyLink = () => {
    const href = (linkValue || '').trim();

    if (href && restoreSelection()) {
      document.execCommand('createLink', false, href);
    }

    setLinkValue(null);
  };

  const removeLink = () => {
    if (!activeField()) return;
    document.execCommand('unlink');
    refreshStates();
  };

  return (
    <>
      <div className="toolbar">
        {GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="group">
            {group.map((button) => {
              const Icon = button.icon;
              return (
                <button
                  key={button.title}
                  type="button"
                  className={activeStates[button.title] ? 'active' : ''}
                  title={button.title}
                  aria-label={button.title}
                  aria-pressed={button.state ? !!activeStates[button.title] : undefined}
                  // Zonder dit verliest de tekst zijn selectie bij het aanklikken
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(button)}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        ))}

        <div className="group">
          <button
            type="button"
            title="Link toevoegen"
            aria-label="Link toevoegen"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openLinkField}
          >
            <Link2 size={15} />
          </button>
          <button
            type="button"
            title="Link weghalen"
            aria-label="Link weghalen"
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeLink}
          >
            <Link2Off size={15} />
          </button>
        </div>

        {children}
      </div>

      {linkValue !== null && (
        <div className="link-row">
          <input
            type="url"
            value={linkValue}
            autoFocus
            placeholder="https://"
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
              if (event.key === 'Escape') setLinkValue(null);
            }}
          />
          <button type="button" className="button" onClick={applyLink}>
            Toevoegen
          </button>
          <button type="button" className="cancel" title="Annuleren" onClick={() => setLinkValue(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
