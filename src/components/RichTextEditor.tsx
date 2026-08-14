import { useCallback, useEffect, useRef, useState } from 'react';
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
import { isRichText, isRichTextEmpty, plainTextToRichText, sanitizeRichText } from '@/lib/richtext';

interface RichTextEditorProps {
  /** De opmaak als HTML; platte tekst van een oude offerte mag er ook in */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * De knoppen in de balk. Een blok-knop zet de hele alinea om, een opmaak-knop
 * werkt op de selectie. `state` is wat de browser als aan of uit meldt.
 */
type ToolbarButton = {
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

/**
 * Tekstverwerker voor een tekstelement: een balk met knoppen en daaronder het
 * vel waarin je typt. De opmaak gaat als HTML naar buiten.
 *
 * Het schrijven zelf laten we aan de browser over via execCommand. Dat is
 * officieel verouderd, maar het werkt in elke browser en het alternatief is de
 * hele selectie- en ongedaanmaak-administratie zelf bijhouden. De uitvoer wordt
 * opgeschoond, dus wat de browser precies produceert maakt verder niet uit.
 */
export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [linkValue, setLinkValue] = useState<string | null>(null);

  // Platte tekst uit een oude offerte krijgt eenmalig zijn opmaak
  const html = isRichText(value) ? value : plainTextToRichText(value);

  // Alleen schrijven als er van buitenaf iets anders in staat dan in het vel:
  // bij elke toetsaanslag opnieuw vullen zou de cursor naar het begin gooien
  useEffect(() => {
    const editable = editableRef.current;
    if (editable && editable.innerHTML !== html) {
      editable.innerHTML = html;
    }
  }, [html]);

  // Alinea's in plaats van div's, zodat de opmaak overeenkomt met wat we bewaren
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Oudere browsers kennen deze instelling niet; dan blijft het div's maken
      // en zet sanitizeRichText die later om
    }
  }, []);

  const emit = useCallback(() => {
    const editable = editableRef.current;
    if (editable) onChange(sanitizeRichText(editable.innerHTML));
  }, [onChange]);

  /** Leest bij de browser op welke knoppen nu aan staan. */
  const refreshStates = useCallback(() => {
    const editable = editableRef.current;
    if (!editable || !editable.contains(document.getSelection()?.anchorNode ?? null)) return;

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
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshStates);
    return () => document.removeEventListener('selectionchange', refreshStates);
  }, [refreshStates]);

  const run = (button: ToolbarButton) => {
    editableRef.current?.focus();

    // Een tweede klik op dezelfde kop zet de alinea weer terug naar gewoon
    const value =
      button.command === 'formatBlock'
        ? activeStates[button.title]
          ? '<p>'
          : `<${button.value}>`
        : undefined;

    document.execCommand(button.command, false, value);
    emit();
    refreshStates();
  };

  /** Bewaart waar de cursor staat, want die gaat verloren zodra je in het invoerveld klikt. */
  const openLinkField = () => {
    const selection = document.getSelection();
    savedRange.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    setLinkValue('');
  };

  const restoreSelection = () => {
    const selection = document.getSelection();
    if (!savedRange.current || !selection) return;

    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  };

  const applyLink = () => {
    const href = (linkValue || '').trim();
    editableRef.current?.focus();
    restoreSelection();

    if (href) {
      document.execCommand('createLink', false, href);
    }

    setLinkValue(null);
    emit();
  };

  const removeLink = () => {
    editableRef.current?.focus();
    document.execCommand('unlink');
    emit();
    refreshStates();
  };

  return (
    <div className="rich-editor">
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
                  // Zonder dit verliest het vel zijn selectie bij het aanklikken
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

      <div
        ref={editableRef}
        className={`editable${isRichTextEmpty(html) ? ' empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Tekst"
        data-placeholder={placeholder || 'Begin met typen...'}
        onInput={emit}
        onBlur={emit}
        onKeyUp={refreshStates}
        onMouseUp={refreshStates}
        // Plakken gaat als platte tekst naar binnen: opmaak uit Word of van een
        // website sleept stijlen en tags mee die hier niets te zoeken hebben
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          emit();
        }}
      />
    </div>
  );
}
