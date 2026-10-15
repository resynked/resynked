import { useCallback, useEffect, useRef } from 'react';
import FormattingToolbar from '@/components/FormattingToolbar';
import {
  htmlNaarRichText,
  isRichText,
  isRichTextEmpty,
  plainTextToRichText,
  sanitizeRichText,
  tidyRichText,
} from '@/lib/richtext';

interface RichTextEditorProps {
  /** De opmaak als HTML; platte tekst van een oude offerte mag er ook in */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

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
  // Wat we zelf als laatste hebben doorgegeven. Komt dat onveranderd terug,
  // dan staat het al in het vel en hoeft er niets overschreven te worden
  const laatstGestuurd = useRef<string | null>(null);

  // Platte tekst uit een oude offerte krijgt eenmalig zijn opmaak
  const html = isRichText(value) ? value : plainTextToRichText(value);

  /**
   * Het vel bijwerken als er van buitenaf iets anders in komt te staan, zoals
   * bij ongedaan maken.
   *
   * Wat wij zelf net hebben doorgegeven slaan we over. De browser schrijft
   * tijdens het typen niet precies dezelfde HTML als wat wij ervan maken — na
   * de eerste letter staat er nog geen alinea omheen, bij ons wel. Zou je dan
   * het vel opnieuw vullen, dan springt de cursor naar het begin en belandt de
   * tweede letter vóór de eerste.
   */
  useEffect(() => {
    const editable = editableRef.current;
    if (!editable || value === laatstGestuurd.current) return;

    if (editable.innerHTML !== html) editable.innerHTML = html;
  }, [value, html]);

  // Alinea's in plaats van div's, zodat de opmaak overeenkomt met wat we bewaren
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Oudere browsers kennen deze instelling niet; dan blijft het div's maken
      // en zet sanitizeRichText die later om
    }
  }, []);

  /**
   * Tijdens het typen gaat de opmaak er ongemoeid door. Opruimen kan pas als je
   * het vel verlaat: lege alinea's weghalen terwijl iemand nog aan het typen is
   * zou de inhoud onder de cursor vandaan trekken.
   */
  const emit = useCallback(
    (tidy = false) => {
      const editable = editableRef.current;
      if (!editable) return null;

      const clean = sanitizeRichText(editable.innerHTML);
      const uit = tidy ? tidyRichText(clean) : clean;

      laatstGestuurd.current = uit;
      onChange(uit);
      return uit;
    },
    [onChange]
  );

  const getField = useCallback(() => editableRef.current, []);

  return (
    <div className="rich-editor">
      <FormattingToolbar getField={getField} />

      <div
        ref={editableRef}
        className={`editable${isRichTextEmpty(html) ? ' empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Tekst"
        data-placeholder={placeholder || 'Vul een tekst in'}
        onInput={() => emit()}
        onBlur={() => {
          const opgeruimd = emit(true);
          const editable = editableRef.current;
          if (editable && opgeruimd !== null && editable.innerHTML !== opgeruimd) {
            editable.innerHTML = opgeruimd;
          }
        }}
        // Geplakte opmaak blijft behouden, teruggebracht tot wat wij kennen:
        // koppen, opsommingen en vet of cursief. Stijlen, kleuren en de rest
        // gaan eruit, zodat tekst uit een andere offerte er meteen goed staat
        // en niet eerst met de hand opgemaakt hoeft te worden
        onPaste={(event) => {
          event.preventDefault();

          const opgemaakt = htmlNaarRichText(event.clipboardData.getData('text/html'));
          if (opgemaakt && !isRichTextEmpty(opgemaakt)) {
            document.execCommand('insertHTML', false, opgemaakt);
            emit();
            return;
          }

          // Zonder opmaak op het klembord: regelafbrekingen worden alinea's,
          // anders staat er na elke witregel een lege alinea
          const text = event.clipboardData.getData('text/plain');

          if (text.includes('\n')) {
            document.execCommand('insertHTML', false, plainTextToRichText(text));
          } else {
            document.execCommand('insertText', false, text);
          }

          emit();
        }}
      />
    </div>
  );
}
