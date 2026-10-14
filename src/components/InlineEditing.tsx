import { createContext, HTMLAttributes, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import {
  htmlNaarRichText,
  isRichText,
  isRichTextEmpty,
  plainTextToRichText,
  sanitizeRichText,
  tidyRichText,
} from '@/lib/richtext';

/**
 * Bewerken op het papier zelf.
 *
 * De velden hier zijn de tekst in de offerte, met contentEditable: wat je typt
 * staat meteen op de plek waar het in de PDF komt, in de opmaak van het sjabloon.
 *
 * Het lastige is dat het document onder je handen opnieuw ingedeeld wordt. Typ
 * je een vel vol, dan verhuist de laatste alinea naar het volgende vel — en
 * daarmee ook de cursor. Daarom onthoudt elk veld bij het typen waar de cursor
 * staat, op een manier die een nieuwe indeling overleeft: welk veld, de
 * hoeveelste alinea van de hele tekst, het hoeveelste teken daarin.
 */

/** Waar in de offerte iemand mee bezig is. */
export interface EditTarget {
  block: number;
  element?: number;
  /** De regel in een prijstabel */
  item?: number;
}

/** Waar de cursor staat, los van op welk vel. */
export interface CaretPosition {
  /** Het veld, zoals "tekst:2:0" voor het eerste element van het derde blok */
  field: string;
  /** In een tekst: de hoeveelste alinea, over de hele tekst geteld */
  node: number;
  /** Het hoeveelste teken binnen die alinea, of binnen het veld */
  offset: number;
}

export interface InlineEditing {
  /** Aangeroepen bij elke toetsaanslag, zodat de cursor straks terug kan */
  rememberCaret: () => void;
  /** Iemand klikt of tabt naar een onderdeel */
  select: (target: EditTarget) => void;
  /** Welk onderdeel er nu bewerkt wordt */
  selected: EditTarget | null;
}

export const InlineEditContext = createContext<InlineEditing | null>(null);

/** Namen voor de velden, zodat de cursor zijn veld terugvindt. */
export const fieldKeys = {
  title: (block: number) => `titel:${block}`,
  heading: (block: number, element: number) => `kop:${block}:${element}`,
  text: (block: number, element: number) => `tekst:${block}:${element}`,
  description: (block: number, element: number, item: number) => `omschrijving:${block}:${element}:${item}`,
  price: (block: number, element: number, item: number) => `prijs:${block}:${element}:${item}`,
};

function charactersUntil(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** Leest waar de cursor nu staat, als dat in een van onze velden is. */
export function readCaret(): CaretPosition | null {
  const selection = document.getSelection();
  const node = selection?.focusNode;
  if (!selection || !node) return null;

  const offset = selection.focusOffset;
  const field = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-bewerk]');
  if (!field) return null;

  const key = field.dataset.bewerk || '';

  // Een gewoon veld: alleen het teken telt
  if (field.dataset.van === undefined) return { field: key, node: 0, offset: charactersUntil(field, node, offset) };

  const start = Number(field.dataset.van) || 0;
  if (node === field) return { field: key, node: start + offset, offset: 0 };

  let paragraph: Node | null = node;
  while (paragraph && paragraph.parentNode !== field) paragraph = paragraph.parentNode;
  if (!paragraph) return null;

  return {
    field: key,
    node: start + Array.from(field.childNodes).indexOf(paragraph as ChildNode),
    offset: charactersUntil(paragraph, node, offset),
  };
}

/**
 * Zet de cursor terug. Loopt een tekst over meerdere vellen, dan zoekt hij het
 * vel waar die alinea nu staat.
 */
export function restoreCaret(within: HTMLElement, caret: CaretPosition) {
  const fields = Array.from(within.querySelectorAll<HTMLElement>(`[data-bewerk="${CSS.escape(caret.field)}"]`));
  if (fields.length === 0) return;

  let field = fields[0];
  let target: Node = field;

  if (field.dataset.van !== undefined) {
    field =
      fields.find((candidate) => {
        const start = Number(candidate.dataset.van) || 0;
        return caret.node >= start && caret.node < start + candidate.childNodes.length;
      }) ?? fields[fields.length - 1];

    target = field.childNodes[caret.node - (Number(field.dataset.van) || 0)] ?? field;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let remaining = caret.offset;
  let placed = false;

  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const length = text.nodeValue?.length ?? 0;
    if (remaining <= length) {
      range.setStart(text, remaining);
      range.collapse(true);
      placed = true;
      break;
    }
    remaining -= length;
  }

  // Bestaat die plek niet meer, dan aan het eind van wat er wel is
  if (!placed) {
    range.selectNodeContents(target);
    range.collapse(false);
  }

  field.focus({ preventScroll: true });
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  // Is de tekst naar het volgende vel verhuisd, dan gaat het scherm mee
  (target instanceof Element ? target : field).scrollIntoView({ block: 'nearest' });
}

/** Of de cursor op dezelfde plek staat. */
export function sameCaret(a: CaretPosition | null, b: CaretPosition | null): boolean {
  return !!a && !!b && a.field === b.field && a.node === b.node && a.offset === b.offset;
}

type EditableTextProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  /** Welk element het wordt; in een tabel bijvoorbeeld de cel zelf */
  as?: 'span' | 'h2' | 'td' | 'strong';
  field: string;
  value: string;
  onChange: (value: string) => void;
  colSpan?: number;
};

/**
 * Een stukje platte tekst dat je op het papier aanpast: een kop, een titel,
 * een omschrijving in de prijstabel. Enter maakt er geen tweede regel van.
 */
export function EditableText({ as: Tag = 'span', field, value, onChange, onKeyDown, ...rest }: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const editing = useContext(InlineEditContext);
  // Wat we zelf als laatste hebben doorgegeven; dat staat er al
  const sent = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === sent.current) return;

    sent.current = null;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  const Element = Tag as any;

  return (
    <Element
      {...rest}
      ref={ref}
      data-bewerk={field}
      contentEditable
      suppressContentEditableWarning
      onInput={() => {
        const text = ref.current?.textContent || '';
        sent.current = text;
        editing?.rememberCaret();
        onChange(text);
      }}
      onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter') event.preventDefault();
        onKeyDown?.(event);
      }}
      onPaste={(event: React.ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ');
        document.execCommand('insertText', false, text);
      }}
    />
  );
}

/** Knipt opgemaakte tekst in losse alinea's, kopjes en lijsten. */
function splitParagraphs(html: string): string[] {
  if (typeof window === 'undefined') return [html];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.childNodes).map((node) =>
    node.nodeType === 1 ? (node as HTMLElement).outerHTML : node.textContent || ''
  );
}

interface EditableRichTextProps {
  field: string;
  /** De hele tekst van het element, zoals hij bewaard is */
  value: string;
  /** Het stuk dat op dit vel staat, zoals de indeling het heeft geknipt */
  from?: number;
  to?: number;
  /** Krijgt de hele tekst terug, niet alleen het stuk van dit vel */
  onChange: (html: string) => void;
  /** Voor de indeling: het hoeveelste onderdeel van het vel dit is */
  part: number;
  className?: string;
  label?: string;
  onFocus?: () => void;
}

/**
 * Een tekstelement, opgemaakt, rechtstreeks op het papier.
 *
 * Staat de tekst over twee vellen, dan is elk vel een eigen veld met zijn deel
 * van de alinea's. Wat je in het ene deel typt wordt weer aan de rest geplakt,
 * zodat er altijd één tekst opgeslagen wordt.
 */
export function EditableRichText({ field, value, from, to, onChange, part, className, label, onFocus }: EditableRichTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const editing = useContext(InlineEditContext);
  const sent = useRef<{ value: string; from?: number; to?: number } | null>(null);

  // Niet opgeruimd zoals bij het tonen: een lege alinea aan het eind is hier
  // gewoon de regel waar iemand na een Enter verder typt. Platte tekst uit
  // een oude offerte krijgt wel zijn opmaak
  const html = isRichText(value) ? sanitizeRichText(value) : plainTextToRichText(value);
  const paragraphs = splitParagraphs(html);
  const start = from ?? 0;
  const end = to ?? paragraphs.length;
  const partHtml = paragraphs.slice(start, end).join('');

  // Alleen bijwerken als er iets anders in moet dan wat er al staat, anders
  // springt de cursor bij elke letter naar het begin
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const last = sent.current;
    if (last && last.value === value && last.from === from && last.to === to) return;

    sent.current = null;
    if (el.innerHTML !== partHtml) el.innerHTML = partHtml;
  }, [value, from, to, partHtml]);

  // Alinea's in plaats van div's, zodat de opmaak overeenkomt met wat we bewaren
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Oudere browsers kennen deze instelling niet; sanitizeRichText zet de
      // div's later om
    }
  }, []);

  const whole = (tidy: boolean) => {
    const own = sanitizeRichText(ref.current?.innerHTML || '');
    const result = paragraphs.slice(0, start).join('') + own + paragraphs.slice(end).join('');
    return tidy ? tidyRichText(result) : result;
  };

  const emit = () => {
    const result = whole(false);
    sent.current = { value: result, from, to };
    editing?.rememberCaret();
    onChange(result);
  };

  return (
    <div
      ref={ref}
      className={className}
      data-element="tekst"
      data-stuk={part}
      data-van={start}
      data-bewerk={field}
      data-label={label}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Tekst"
      onInput={emit}
      onFocus={onFocus}
      // Opruimen kan pas als je het veld verlaat: lege alinea's weghalen
      // terwijl iemand nog typt zou de tekst onder de cursor vandaan trekken
      onBlur={() => {
        const tidied = whole(true);
        if (tidied !== value) onChange(tidied);
      }}
      // Geplakte opmaak blijft behouden, teruggebracht tot wat wij kennen
      onPaste={(event) => {
        event.preventDefault();

        const formatted = htmlNaarRichText(event.clipboardData.getData('text/html'));
        if (formatted && !isRichTextEmpty(formatted)) {
          document.execCommand('insertHTML', false, formatted);
        } else {
          // Zonder opmaak op het klembord: regelafbrekingen worden alinea's
          const text = event.clipboardData.getData('text/plain');
          if (text.includes('\n')) document.execCommand('insertHTML', false, plainTextToRichText(text));
          else document.execCommand('insertText', false, text);
        }

        emit();
      }}
    />
  );
}
