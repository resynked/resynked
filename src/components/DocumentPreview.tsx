import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import TemplatedDocument from '@/components/TemplatedDocument';
import PaymentDetails from '@/components/PaymentDetails';
import ProductSuggestions, { matchProducts } from '@/components/ProductSuggestions';
import { useProducts } from '@/hooks/useProducts';
import { documentTemplate } from '@/lib/document-templates';
import { emptyItem } from '@/lib/blocks';
import { Skeleton } from '@/components/Skeleton';
import {
  EditableRichText,
  EditableText,
  InlineEditContext,
  fieldKeys,
  readCaret,
  restoreCaret,
  sameCaret,
  type CaretPosition,
  type EditTarget,
} from '@/components/InlineEditing';
import type { Customer, DocumentBlock, DocumentElement, LineItem, Product, Tenant } from '@/lib/supabase';
import { isRichTextEmpty, toDisplayHtml } from '@/lib/richtext';
import {
  eersteIndeling,
  elementenVanVel,
  gelijkeIndeling,
  knipVel,
  resetChangedBlocks,
  snijTekst,
  type Knip,
  type Stuk,
  type Vel,
} from '@/lib/pagination';
import {
  allPriceTables,
  calculateDocumentTotal,
  calculateElementTotals,
  formatCurrency,
  formatDate,
  getCustomerDisplayName,
  lineTotal,
} from '@/lib/utils';

interface DocumentPreviewProps {
  title: 'Offerte' | 'Factuur';
  /** Regels bij het gegevens-element, bijvoorbeeld nummer en datums */
  meta: { label: string; value: string }[];
  customer?: Partial<Customer> | null;
  blocks: DocumentBlock[];
  currency?: string;
  /**
   * De bedrijfsgegevens. De schermen binnen de app halen die zelf op, maar de
   * publieke offertepagina heeft geen sessie en geeft ze mee.
   */
  tenant?: Tenant | null;
  /** De handtekening van de klant, zodra die er is */
  signature?: SignatureState | null;
  /**
   * Alleen bij een factuur: de omschrijving en vervaldatum voor het betaalblok
   * met de QR-code. Het bedrag is het totaal, de rekening het IBAN van het bedrijf
   */
  payment?: { reference: string; dueDate?: string | null } | null;
  /**
   * Wat er op de plek van het handtekening-element komt zolang er niet getekend
   * is. De offertepagina van de klant zet hier het tekenvak neer; in de app
   * blijft dit leeg en staan er lijnen.
   */
  signatureField?: React.ReactNode;
  /** Welk blok, element of regel er op dit moment bewerkt wordt */
  selected?: EditTarget | null;
  /** Aangeroepen bij een klik op een blok, element of regel in het document */
  onSelect?: (target: EditTarget) => void;
  /**
   * Bewerken op het papier zelf: de tekst, koppen, titels en regels worden
   * velden waarin je typt. Krijgt het gewijzigde blok terug.
   */
  onChangeBlock?: (index: number, block: DocumentBlock) => void;
  /** Zet de cursor in dit veld, bijvoorbeeld in een kop die net is toegevoegd */
  focusField?: { field: string } | null;
  /** Een element dat op het papier naar een andere plek is gesleept */
  onMoveElement?: (from: EditTarget, to: EditTarget) => void;
  /** Voegt een blok toe op een bepaalde plek in de lijst */
  onAddBlock?: (atIndex: number) => void;
  /**
   * Maakt van een vervolgvel een eigen blok, geknipt op de plek waar het
   * vel begon. Daarna is het vervolg los te bewerken.
   */
  onSplitBlock?: (blok: number, vanaf: Stuk) => void;
  /** Zet een blok op een andere plek in het document */
  onMoveBlock?: (van: number, naar: number) => void;
  /**
   * Hoe groot het papier op het scherm staat. "passend" verkleint het vel tot
   * het in beeld past, zoals in de editor; "vol" laat het op ware grootte
   * staan, wat de afdrukpagina nodig heeft.
   */
  papier?: 'passend' | 'vol';
}

/**
 * De tekst van een tekstelement, met zijn opmaak.
 *
 * Wat de editor oplevert is HTML; een tekst van vóór de editor staat als platte
 * tekst in de database en wordt omgezet. Beide gaan langs de opschoning van
 * richtext. De opmaak hangt aan het element zelf, zodat er geen tweede div om
 * heen komt: die hoort bij het blok en niet bij de tekst.
 */
function TextElement({
  body,
  bewerkbaar,
  stuk,
  van,
  tot,
}: {
  body: string | null;
  bewerkbaar: boolean;
  stuk: number;
  van?: number;
  tot?: number;
}) {
  if (!body || isRichTextEmpty(body)) {
    // Zonder tekst valt het element weg; alleen in de editor staat er een hint,
    // want anders belandt "Tekst toevoegen" in de PDF die de klant krijgt
    return bewerkbaar ? (
      <div data-element="tekst" className="rich-text" data-stuk={stuk}>
        <p>Tekst toevoegen</p>
      </div>
    ) : null;
  }

  // Loopt de tekst over het vel, dan staat hier alleen het deel dat past;
  // de rest komt op het volgende vel onder hetzelfde opschrift
  const html = snijTekst(toDisplayHtml(body), van, tot);
  if (!html.trim()) return null;

  return (
    <div
      data-element="tekst"
      className="rich-text"
      data-stuk={stuk}
      data-van={van ?? 0}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Een klik naast een leeg veld, op de rand van de cel, zet de cursor toch in
 * dat veld. Anders valt er op een lege tussenkop niets aan te klikken.
 */
function focusInnerField(event: React.MouseEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return;

  const field = event.currentTarget.querySelector<HTMLElement>('[data-bewerk]');
  if (!field) return;

  event.preventDefault();
  field.focus();

  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

/** "1.250,50" of "1250.5" wordt 1250.5; wat geen getal is telt als nul. */
/** 2,5 in plaats van 2.5, en geen nullen achter de komma */
function formatQuantity(quantity: number | string): string {
  return Number(quantity).toLocaleString('nl-NL', { maximumFractionDigits: 3 });
}

function parseAmount(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const amount = parseFloat(normalized);
  return Number.isNaN(amount) ? 0 : amount;
}

/**
 * Het bedrag van een regel. Zolang je erin typt staat er het kale getal, met
 * een komma zoals je hem intikt; daarbuiten het bedrag zoals de klant het ziet.
 */
/**
 * Een getal in de prijstabel om op het papier te bewerken: de prijs of het
 * aantal. Je ziet het opgemaakt ("€ 12,50"), en bij het aanklikken het kale
 * getal ("12,5"), klaar om over te typen.
 */
function PriceCell({
  field,
  price,
  display,
  onChange,
}: {
  field: string;
  /** Het getal zelf */
  price: number;
  /** Hoe het er buiten het bewerken uitziet */
  display: string;
  onChange: (price: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // Bij het aanklikken staat het hele getal geselecteerd, klaar om over te typen
  const startedEditing = useRef(false);
  useLayoutEffect(() => {
    if (!startedEditing.current) return;
    startedEditing.current = false;

    const el = document.activeElement as HTMLElement | null;
    if (el?.dataset.bewerk !== field) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }, [draft, field]);

  return (
    <EditableText
      as="td"
      field={field}
      value={draft ?? display}
      onFocus={() => {
        startedEditing.current = true;
        setDraft(String(price).replace('.', ','));
      }}
      onBlur={() => setDraft(null)}
      onChange={(text) => {
        setDraft(text);
        onChange(parseAmount(text));
      }}
    />
  );
}

/**
 * De tabel met regels en de subtotalen van één prijstabel.
 *
 * Een lange tabel loopt door op het volgende vel. `van` en `tot` zeggen welk
 * stuk hier staat: de regels zijn genummerd van nul af, en het blokje met de
 * subtotalen telt als de regel daarachter. Zo staan de totalen altijd onder
 * de laatste regel en nooit halverwege, en krijgt elk vel zijn eigen koprij.
 */
function PriceTable({
  element,
  currency,
  van,
  tot,
  edit,
}: {
  element: DocumentElement;
  currency: string;
  van?: number;
  tot?: number;
  /** Op het papier bewerken: welk blok en element dit is, en waar de wijziging heen gaat */
  edit?: { block: number; element: number; onChange: (items: LineItem[]) => void };
}) {
  const editing = useContext(InlineEditContext);
  const totals = calculateElementTotals(element);

  const changeItem = (index: number, changes: Partial<LineItem>) =>
    edit?.onChange(element.items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  // Productsuggesties terwijl je een omschrijving typt; alleen bij het bewerken
  const products = useProducts(!!edit);
  const [suggest, setSuggest] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const suggestions = suggest ? matchProducts(products, element.items[suggest.index]?.description || '') : [];

  const typeDescription = (index: number, field: string, description: string) => {
    changeItem(index, { description });
    const anchor = document.querySelector<HTMLElement>(`[data-bewerk="${CSS.escape(field)}"]`);
    setSuggest(anchor ? { index, anchor } : null);
    setActiveSuggestion(0);
  };

  // Een product kiezen: de regel krijgt naam, eenheid en prijs als kopie
  const pickProduct = (index: number, product: Product) => {
    changeItem(index, { description: product.name, unit: product.unit, price: Number(product.price) });
    setSuggest(null);
  };

  // Enter in een omschrijving: een nieuwe regel eronder, met de cursor erin
  const addRowBelow = (index: number) => {
    if (!edit) return;
    const at = index + 1;
    edit.onChange([...element.items.slice(0, at), emptyItem(), ...element.items.slice(at)]);
    editing?.select({ block: edit.block, element: edit.element, item: at });
    const field = fieldKeys.description(edit.block, edit.element, at);
    // Pas na het tekenen bestaat het nieuwe veld
    setTimeout(() => document.querySelector<HTMLElement>(`[data-bewerk="${CSS.escape(field)}"]`)?.focus(), 50);
  };

  const descriptionKeys = (index: number) => (event: React.KeyboardEvent<HTMLElement>) => {
    const open = !!suggest && suggest.index === index && suggestions.length > 0;
    if (!open) {
      if (event.key === 'Enter') addRowBelow(index);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSuggestion((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      pickProduct(index, suggestions[activeSuggestion] || suggestions[0]);
    } else if (event.key === 'Escape') {
      setSuggest(null);
    }
  };

  // De regel waar je in klikt wordt de gekozen regel, voor de knoppen erboven
  const selectItem = (index: number) => (event: React.FocusEvent) => {
    if (!edit) return;
    event.stopPropagation();
    editing?.select({ block: edit.block, element: edit.element, item: index });
  };

  // De totalen gaan over de hele tabel, ook als er maar een deel op dit vel staat
  const totalenIndex = element.items.length;
  const vanaf = van ?? 0;
  const totEn = tot ?? totalenIndex + 1;
  const regels = element.items.slice(vanaf, Math.min(totEn, totalenIndex));
  const toonTotalen = totEn > totalenIndex;

  // Aantal, eenheid en prijs per stuk: per prijstabel aan of uit te zetten
  // (het venster "Prijstabel" in de werkbalk), op het scherm en op papier gelijk
  const showQuantity = !!element.show_quantity;
  const columns = showQuantity ? 5 : 2;

  return (
    <>
      {suggest && (
        <ProductSuggestions
          anchor={suggest.anchor}
          products={suggestions}
          active={activeSuggestion}
          onPick={(product) => pickProduct(suggest.index, product)}
        />
      )}
      {regels.length > 0 && (
        <div className="table-container">
          <table className="product-table">
            <thead>
              <tr>
                <th>Omschrijving</th>
                {showQuantity && <th>Aantal</th>}
                {showQuantity && <th>Eenheid</th>}
                {showQuantity && <th>Prijs</th>}
                <th>Bedrag excl. btw</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((item, regelIndex) => {
                const index = vanaf + regelIndex;

                if (edit) {
                  return item.is_heading ? (
                    <tr key={index} data-kop="1" onFocus={selectItem(index)}>
                      <td colSpan={columns} onMouseDown={focusInnerField}>
                        <EditableText
                          as="strong"
                          field={fieldKeys.description(edit.block, edit.element, index)}
                          value={item.description}
                          onChange={(description) => changeItem(index, { description })}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={index} onFocus={selectItem(index)}>
                      <EditableText
                        as="td"
                        field={fieldKeys.description(edit.block, edit.element, index)}
                        value={item.description}
                        onChange={(description) =>
                          typeDescription(index, fieldKeys.description(edit.block, edit.element, index), description)
                        }
                        onKeyDown={descriptionKeys(index)}
                        onBlur={() => setSuggest(null)}
                      />
                      {showQuantity ? (
                        <>
                          <PriceCell
                            field={fieldKeys.quantity(edit.block, edit.element, index)}
                            price={Number(item.quantity)}
                            display={formatQuantity(item.quantity)}
                            onChange={(quantity) => changeItem(index, { quantity })}
                          />
                          <EditableText
                            as="td"
                            field={fieldKeys.unit(edit.block, edit.element, index)}
                            value={item.unit || ''}
                            onChange={(unit) => changeItem(index, { unit: unit.trim() || null })}
                          />
                          <PriceCell
                            field={fieldKeys.price(edit.block, edit.element, index)}
                            price={item.price}
                            display={formatCurrency(item.price, currency)}
                            onChange={(price) => changeItem(index, { price })}
                          />
                          <td>{formatCurrency(lineTotal(item), currency)}</td>
                        </>
                      ) : (
                        // Zonder aantallen is het bedrag gewoon de prijs van de regel
                        <PriceCell
                          field={fieldKeys.price(edit.block, edit.element, index)}
                          price={item.price}
                          display={formatCurrency(lineTotal(item), currency)}
                          onChange={(price) => changeItem(index, { price })}
                        />
                      )}
                    </tr>
                  );
                }

                return item.is_heading ? (
                  <tr key={index} data-kop="1">
                    <td colSpan={columns}>
                      <strong>{item.description}</strong>
                    </td>
                  </tr>
                ) : (
                  <tr key={index}>
                    <td>{item.description}</td>
                    {showQuantity && <td>{formatQuantity(item.quantity)}</td>}
                    {showQuantity && <td>{item.unit || ''}</td>}
                    {showQuantity && <td>{formatCurrency(item.price, currency)}</td>}
                    <td>{formatCurrency(lineTotal(item), currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toonTotalen && (
      <div className="invoice-total">
        <div className="invoice-total-row">
          <span>Subtotaal excl. btw</span>
          <span>{formatCurrency(totals.subtotal, currency)}</span>
        </div>
        {element.discount_percentage > 0 && (
          <div className="invoice-total-row">
            <span>Korting ({element.discount_percentage}%)</span>
            <span>- {formatCurrency(totals.discount, currency)}</span>
          </div>
        )}
        <div className="invoice-total-row">
          <span>BTW ({element.tax_percentage}%)</span>
          <span>{formatCurrency(totals.tax, currency)}</span>
        </div>
        <div className="invoice-total-row total-final">
          <span>Totaal incl. btw</span>
          <span>{formatCurrency(totals.total, currency)}</span>
        </div>
      </div>
      )}
    </>
  );
}

interface BlockViewProps {
  /** Wat er van dit blok op dít vel staat, in volgorde */
  onderdelen: { element: DocumentElement; index: number; van?: number; tot?: number }[];
  currency: string;
  customer?: Partial<Customer> | null;
  meta: { label: string; value: string }[];
  signature?: SignatureState | null;
  signatureField?: React.ReactNode;
  /** In de editor staan er hints bij lege onderdelen; in het document niet */
  bewerkbaar: boolean;
  /** Op het papier bewerken: het blok, en waar een gewijzigd element heen gaat */
  edit?: { block: number; onChange: (element: number, changes: Partial<DocumentElement>) => void };
}

const ELEMENT_LABELS: Record<DocumentElement['kind'], string> = {
  gegevens: 'Gegevens',
  kop: 'Kop',
  tekst: 'Tekst',
  prijstabel: 'Prijstabel',
  handtekening: 'Handtekening',
};

/** Alles wat er in één blok staat, in volgorde. */
function BlockView({ onderdelen, currency, customer, meta, signature, signatureField, bewerkbaar, edit }: BlockViewProps) {
  const editing = useContext(InlineEditContext);
  const drag = editing?.drag;

  /**
   * Waar een gesleept element terechtkomt. Een leeg blok is zelf ook een
   * plek, zodat je er een element naartoe kunt slepen.
   */
  const dropZone = (element: number) =>
    edit && drag?.from
      ? {
          onDragOver: (event: React.DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            const over = drag.over;
            if (over?.block !== edit.block || over?.element !== element) drag.hover({ block: edit.block, element });
          },
          onDrop: (event: React.DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            drag.drop({ block: edit.block, element });
          },
        }
      : {};

  if (onderdelen.length === 0) {
    return bewerkbaar ? <p {...dropZone(0)}>Nog leeg. Klik hier om er tekst of een prijstabel in te zetten.</p> : null;
  }

  const isSelected = (index: number) => {
    const selected = editing?.selected;
    return !!edit && selected?.block === edit.block && selected?.element === index;
  };

  // Het gekozen element licht op, met zijn soort erboven. Bij het slepen
  // vervaagt wat je vasthoudt en licht op waar het heen gaat
  const region = (index: number) => {
    const isDragged = drag?.from?.block === edit?.block && drag?.from?.element === index;
    const isTarget = !isDragged && drag?.over?.block === edit?.block && drag?.over?.element === index;
    return ['editable-region', isSelected(index) && 'active', isDragged && 'dragging', isTarget && 'drop-target']
      .filter(Boolean)
      .join(' ');
  };

  const select = (index: number) => () => {
    if (edit) editing?.select({ block: edit.block, element: index });
  };

  return (
    <>
      {onderdelen.map(({ element, index, van, tot }, stuk) => {
        if (!edit) {
          return element.kind === 'tekst' ? (
            <TextElement key={index} body={element.body} bewerkbaar={bewerkbaar} stuk={stuk} van={van} tot={tot} />
          ) : (
            <div key={index} data-element={element.kind} data-stuk={stuk} data-van={van ?? 0}>
              <ElementContent element={element} van={van} tot={tot} currency={currency} customer={customer} meta={meta} signature={signature} signatureField={signatureField} bewerkbaar={bewerkbaar} />
            </div>
          );
        }

        return (
          <div
            key={index}
            data-element={element.kind}
            data-stuk={stuk}
            data-van={van ?? 0}
            className={region(index)}
            data-label={ELEMENT_LABELS[element.kind]}
            // Een klik in een veld kiest dat veld zelf, met de regel erbij
            onClick={(event) => {
              if (!(event.target as HTMLElement).closest('[data-bewerk]')) select(index)();
            }}
            {...dropZone(index)}
          >
            {/* Aan het handvat sleep je het element naar een andere plek op het
                papier, ook naar een ander blok */}
            {isSelected(index) && (
              <span
                className="drag-handle"
                title="Sleep om dit element te verplaatsen"
                aria-label="Element verplaatsen"
                contentEditable={false}
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', `${edit.block}:${index}`);
                  drag?.start({ block: edit.block, element: index });
                }}
                onDragEnd={() => drag?.end()}
              >
                <GripVertical size={16} />
              </span>
            )}

            {element.kind === 'tekst' ? (
              <EditableRichText
                field={fieldKeys.text(edit.block, index)}
                value={element.body || ''}
                from={van}
                to={tot}
                className="rich-text"
                onFocus={select(index)}
                onChange={(body) => edit.onChange(index, { body })}
              />
            ) : element.kind === 'kop' ? (
              <EditableText
                as="h2"
                field={fieldKeys.heading(edit.block, index)}
                value={element.body || ''}
                onFocus={select(index)}
                onChange={(body) => edit.onChange(index, { body })}
              />
            ) : (
              <ElementContent
                element={element}
                van={van}
                tot={tot}
                currency={currency}
                customer={customer}
                meta={meta}
                signature={signature}
                signatureField={signatureField}
                bewerkbaar={bewerkbaar}
                onItemsChange={(items) => edit.onChange(index, { items })}
                editTarget={{ block: edit.block, element: index }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/** De inhoud van een element dat geen lopende tekst is. */
function ElementContent({
  element,
  van,
  tot,
  currency,
  customer,
  meta,
  signature,
  signatureField,
  bewerkbaar,
  onItemsChange,
  editTarget,
}: {
  element: DocumentElement;
  van?: number;
  tot?: number;
  currency: string;
  customer?: Partial<Customer> | null;
  meta: { label: string; value: string }[];
  signature?: SignatureState | null;
  signatureField?: React.ReactNode;
  bewerkbaar: boolean;
  /** Op het papier bewerken: waar gewijzigde regels van een prijstabel heen gaan */
  onItemsChange?: (items: LineItem[]) => void;
  editTarget?: { block: number; element: number };
}) {
  return (
    <>
      {element.kind === 'gegevens' && (
        <>
          {/* Naam, straat met huisnummer, postcode met plaats */}
          <div className="customer-details">
            {customer ? (
              <>
                <div>{getCustomerDisplayName(customer)}</div>
                {customer.street_address && <div>{customer.street_address}</div>}
                {(customer.postal_code || customer.city) && (
                  <div>{[customer.postal_code, customer.city].filter(Boolean).join(' ')}</div>
                )}
              </>
            ) : (
              bewerkbaar && <div>Nog geen klant gekozen</div>
            )}
          </div>

          {/* Label en waarde elk in een span, zodat ze los te stijlen zijn */}
          <div className="document-meta">
            {meta
              .filter(row => row.value)
              .map(row => (
                <div key={row.label}>
                  <span className="label">{row.label}</span>
                  <span className="value">{row.value}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {element.kind === 'kop' && (element.body ? <h2>{element.body}</h2> : bewerkbaar && <h2>Kop toevoegen</h2>)}

      {element.kind === 'handtekening' && <SignatureElement signature={signature} field={signatureField} />}

      {element.kind === 'prijstabel' && (
        <PriceTable
          element={element}
          currency={currency}
          van={van}
          tot={tot}
          edit={editTarget && onItemsChange && { ...editTarget, onChange: onItemsChange }}
        />
      )}
    </>
  );
}

/** Wat er van de handtekening bekend is; leeg zolang er niet getekend is. */
export interface SignatureState {
  image?: string | null;
  name?: string | null;
  signedAt?: string | null;
}

/**
 * De plek in het document waar de klant tekent.
 *
 * Drie toestanden: getekend toont de handtekening zelf; niet getekend op de
 * pagina van de klant toont het tekenvak; overal elders de lijnen, zoals op een
 * offerte die je uitprint en met de hand laat tekenen.
 */
function SignatureElement({
  signature,
  field,
}: {
  signature?: SignatureState | null;
  field?: React.ReactNode;
}) {
  if (signature?.signedAt) {
    return (
      <div className="signature-fields signed">
        <div className="field">
          <span className="filled">{formatDate(signature.signedAt)}</span>
          <span className="line" />
          <span className="caption">Plaats / datum</span>
        </div>

        <div className="field">
          <span className="filled">
            {signature.image && <img src={signature.image} alt={`Handtekening van ${signature.name || ''}`} />}
          </span>
          <span className="line" />
          <span className="caption">Handtekening opdrachtgever</span>
        </div>
      </div>
    );
  }

  // Alleen op de pagina van de klant: daar wordt dit het tekenvak
  if (field) return <div className="signature-fields signing">{field}</div>;

  return (
    <div className="signature-fields">
      <div className="field">
        <span className="line" />
        <span className="caption">Plaats / datum</span>
      </div>

      <div className="field">
        <span className="line" />
        <span className="caption">Handtekening opdrachtgever</span>
      </div>
    </div>
  );
}

/**
 * Zoekt op een vel het eerste onderdeel dat er niet meer op past.
 *
 * Er wordt niet gerekend maar gemeten: elk onderdeel heeft een plek op het
 * papier, en wie daarbuiten valt gaat mee naar het volgende vel. Zo werkt het
 * ook bij een pagina in twee kolommen, waar het overlopen naar rechts gebeurt
 * in plaats van naar beneden.
 */
function zoekKnip(pagina: HTMLElement, slot: HTMLElement, schaal: number): Knip | null {
  const vel = pagina.getBoundingClientRect();

  // De witruimte onderaan en rechts hoort bij de marge, niet bij de ruimte
  let onder = 0;
  let rechts = 0;
  for (let el: HTMLElement | null = slot; el && el !== pagina; el = el.parentElement) {
    const stijl = getComputedStyle(el);
    onder += parseFloat(stijl.paddingBottom) || 0;
    rechts += parseFloat(stijl.paddingRight) || 0;
  }

  const grensOnder = vel.bottom - onder * schaal;
  const grensRechts = vel.right - rechts * schaal;

  const past = (el: Element) => {
    const r = el.getBoundingClientRect();
    // Iets zonder afmeting staat nergens in de weg
    if (r.height === 0 && r.width === 0) return true;
    return r.bottom <= grensOnder + 1 && r.right <= grensRechts + 1;
  };

  for (const kind of Array.from(slot.children)) {
    const el = kind as HTMLElement;
    const stuk = Number(el.dataset.stuk);
    if (Number.isNaN(stuk) || past(el)) continue;

    // Een tekst mag tussen de alinea's door in tweeën; alle andere
    // onderdelen schuiven in hun geheel op
    if (el.dataset.element === 'tekst') {
      const van = Number(el.dataset.van) || 0;
      // In de editor staan de alinea's in het tekstveld, naast het handvat
      const tekst = el.querySelector<HTMLElement>('[data-bewerk]') ?? el;
      const knopen = Array.from(tekst.children);
      for (let i = 0; i < knopen.length; i++) {
        if (past(knopen[i])) continue;

        // Een kopje hoort bij wat eronder staat. Valt dat op het volgende
        // vel, dan gaat het kopje mee — anders blijft er een losse regel
        // onderaan de pagina achter
        let knip = i;
        while (knip > 0 && isKop(knopen[knip - 1])) knip--;

        return { stuk, knoop: van + knip };
      }
    }

    // Een prijstabel mag tussen twee regels doormidden. De regels zijn
    // genummerd van nul af en het blokje met de subtotalen telt als de regel
    // daarachter, zodat de totalen altijd onder de laatste regel belanden
    if (el.dataset.element === 'prijstabel') {
      const van = Number(el.dataset.van) || 0;
      const rijen = Array.from(el.querySelectorAll<HTMLElement>('tbody > tr'));
      const totalen = el.querySelector<HTMLElement>('.invoice-total');
      const knopen: Element[] = totalen ? [...rijen, totalen] : rijen;

      for (let i = 0; i < knopen.length; i++) {
        if (past(knopen[i])) continue;

        // Een tussenkop hoort bij de regels eronder
        let knip = i;
        while (knip > 0 && (knopen[knip - 1] as HTMLElement).dataset?.kop === '1') knip--;

        // Past zelfs de eerste regel niet, dan gaat de hele tabel mee
        if (knip > 0) return { stuk, knoop: van + knip };
        break;
      }
    }

    // Hetzelfde voor een los kop-element vlak voor bijvoorbeeld een prijstabel
    const vorige = el.previousElementSibling as HTMLElement | null;
    if (vorige?.dataset.element === 'kop' && stuk > 0) return { stuk: stuk - 1 };

    return { stuk };
  }

  return null;
}

/** Kopjes horen bij de tekst eronder en gaan dus met die tekst mee. */
function isKop(el: Element): boolean {
  return /^H[1-6]$/.test(el.tagName);
}

/** Een vel zonder inhoud heeft geen zin; daar mag de knip niet op uitkomen. */
function heeftInhoud(vel: Vel): boolean {
  return vel.stukken.some(stuk => stuk.van === undefined || stuk.tot === undefined || stuk.tot > stuk.van);
}

/**
 * Loopt alle vellen na en splitst wat overloopt. Levert niets op als alles
 * past, zodat het meten vanzelf tot rust komt.
 */
function herverdeel(papier: HTMLElement, vellen: Vel[], schaal: number): Vel[] | null {
  const paginas = papier.querySelectorAll<HTMLElement>('[data-blok-titel]');
  // Het papier loopt nog achter op de indeling; volgende ronde opnieuw
  if (paginas.length !== vellen.length) return null;

  const nieuw: Vel[] = [];
  let veranderd = false;

  vellen.forEach((vel, i) => {
    const slot = paginas[i].querySelector<HTMLElement>('[data-slot^="blok-"]');
    const knip = slot ? zoekKnip(paginas[i], slot, schaal) : null;

    if (!knip) {
      nieuw.push(vel);
      return;
    }

    const [eerste, rest] = knipVel(vel, knip);

    // Past één onderdeel op zichzelf al niet op een vel, dan valt er niets te
    // verschuiven en laten we het staan — anders blijft het opdelen doorgaan
    if (!heeftInhoud(eerste) || !heeftInhoud(rest)) {
      nieuw.push(vel);
      return;
    }

    nieuw.push(eerste, rest);
    veranderd = true;
  });

  return veranderd ? nieuw : null;
}

/** Strook waar bij hover een plusje verschijnt om een blok toe te voegen. */
function AddBlockDivider({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="add-block-divider">
      <div className="add-block">
        <button
          type="button"
          className="button add-item"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          + Blok
        </button>
      </div>
    </div>
  );
}

/** Papieren weergave van een offerte of factuur, zoals de klant hem krijgt. */
export default function DocumentPreview({
  title,
  meta,
  customer,
  blocks,
  currency = 'EUR',
  tenant: givenTenant,
  signature,
  payment,
  signatureField,
  selected,
  onSelect,
  onChangeBlock,
  focusField,
  onMoveElement,
  onAddBlock,
  onSplitBlock,
  onMoveBlock,
  papier = 'passend',
}: DocumentPreviewProps) {
  const [fetchedTenant, setFetchedTenant] = useState<Tenant | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(!givenTenant);

  // De verdeling over de vellen, en hoe klein het papier op het scherm staat
  const [vellen, setVellen] = useState<Vel[]>(() => eersteIndeling(blocks));
  const [schaal, setSchaal] = useState(1);
  // Zolang dit niet klaar is, kan er nog een vel bij komen. De server wacht
  // erop voordat hij er een PDF van maakt
  const [indelingKlaar, setIndelingKlaar] = useState(false);

  // Welk vel er gesleept wordt en waar het heen gaat. Het slepen zelf leest
  // uit de ref: die is meteen bij, terwijl de toestand pas bij de volgende
  // tekening klopt — en de eerste sleepbeweging komt daar soms vóór
  const [sleeptVel, setSleeptVel] = useState<number | null>(null);
  const [doelVel, setDoelVel] = useState<number | null>(null);
  const sleept = useRef<number | null>(null);

  const pakOp = (index: number | null) => {
    sleept.current = index;
    setSleeptVel(index);
    if (index === null) setDoelVel(null);
  };
  const vensterRef = useRef<HTMLDivElement>(null);
  const papierRef = useRef<HTMLDivElement>(null);
  const rondes = useRef(0);

  // Verandert er iets aan een blok, dan begint het opdelen van dat blok
  // opnieuw. Anders zou een verwijderde alinea een leeg vel achterlaten.
  // Dit gebeurt al tijdens het tekenen, zodat er nooit een vel met de oude
  // indeling en de nieuwe tekst op het scherm staat
  const blokkenSleutel = JSON.stringify(blocks);
  const [getekend, setGetekend] = useState({ sleutel: blokkenSleutel, blocks });
  if (getekend.sleutel !== blokkenSleutel) {
    setGetekend({ sleutel: blokkenSleutel, blocks });
    setVellen(huidig => resetChangedBlocks(huidig, getekend.blocks, blocks));
    setIndelingKlaar(false);
    rondes.current = 0;
  }

  // Welk element er over het papier gesleept wordt, en waar het boven hangt
  const [elementSleep, setElementSleep] = useState<{ from: EditTarget; over: EditTarget | null } | null>(null);

  // Waar de cursor stond toen er getypt werd. Verhuist de tekst naar een
  // ander vel, dan komt hij daar terug zodra de indeling stilligt
  const caret = useRef<CaretPosition | null>(null);
  const restorePending = useRef(false);

  const rememberCaret = () => {
    caret.current = readCaret();
    restorePending.current = true;
  };

  // Een veld dat net is toegevoegd krijgt meteen de cursor
  const gevraagdeFocus = useRef(focusField);
  if (focusField !== gevraagdeFocus.current) {
    gevraagdeFocus.current = focusField;
    if (focusField) {
      caret.current = { field: focusField.field, node: 0, offset: 0 };
      restorePending.current = true;
    }
  }

  const settleCaret = (binnen: HTMLElement | null) => {
    if (!binnen || !restorePending.current || !caret.current) return;

    restorePending.current = false;
    if (!sameCaret(readCaret(), caret.current)) restoreCaret(binnen, caret.current);
  };

  /**
   * Meten nog voordat de browser tekent. Loopt er iets over, dan wordt het
   * meteen opnieuw ingedeeld en weer gemeten, net zolang tot alles past —
   * zonder tussenstanden op het scherm terwijl iemand typt.
   */
  const meetMeteen = () => {
    const papierEl = papierRef.current;
    if (!papierEl || papierEl.querySelectorAll('[data-blok-titel]').length !== vellen.length) return;

    const opnieuw = herverdeel(papierEl, vellen, schaal);
    if (opnieuw && !gelijkeIndeling(opnieuw, vellen) && rondes.current <= 40) {
      rondes.current += 1;
      setVellen(opnieuw);
      return;
    }

    settleCaret(papierEl);
  };

  // Zonder eigen sjabloon wordt er niet ingedeeld; de cursor kan meteen terug
  const kaleWeergaveRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    settleCaret(kaleWeergaveRef.current);
  });

  // Het papier op ware verhouding tonen, verkleind tot het in beeld past
  useEffect(() => {
    if (papier === 'vol') return;

    const pas = () => {
      const venster = vensterRef.current;
      const vel = papierRef.current?.querySelector<HTMLElement>('[data-blok-titel]');
      if (!venster || !vel?.offsetWidth) return;

      const nieuw = Math.min(1, venster.clientWidth / vel.offsetWidth);
      setSchaal(huidig => (Math.abs(huidig - nieuw) < 0.001 ? huidig : nieuw));

      // Het verkleinen gebeurt met transform en telt niet mee voor de hoogte,
      // dus die zetten we er zelf bij — anders blijft er wit onder het papier
      const hoog = papierRef.current?.offsetHeight;
      if (hoog) venster.style.height = `${hoog * nieuw}px`;
    };

    pas();
    window.addEventListener('resize', pas);
    return () => window.removeEventListener('resize', pas);
  });

  // Nameten of alles nog op zijn vel staat. Wat overloopt verhuist naar een
  // volgend vel, net zolang tot er niets meer verschuift. Er wordt daarna nog
  // even doorgekeken: lettertypes, plaatjes en kolommen zetten de tekst soms
  // pas na de eerste tekening op zijn definitieve plek
  useEffect(() => {
    let gestopt = false;
    let stil = 0;
    let wacht: ReturnType<typeof setTimeout>;

    const nogEens = (na: number) => {
      wacht = setTimeout(() => requestAnimationFrame(kijk), na);
    };

    const kijk = () => {
      if (gestopt) return;

      const papierEl = papierRef.current;
      // Het papier loopt nog achter op de indeling; zo weer kijken
      if (!papierEl || papierEl.querySelectorAll('[data-blok-titel]').length !== vellen.length) {
        nogEens(60);
        return;
      }

      const opnieuw = herverdeel(papierEl, vellen, schaal);

      if (opnieuw && !gelijkeIndeling(opnieuw, vellen) && rondes.current <= 40) {
        rondes.current += 1;
        setVellen(opnieuw);
        return;
      }

      // Acht keer achter elkaar niets zien verschuiven, dan ligt het stil
      stil += 1;
      if (stil >= 8) {
        setIndelingKlaar(true);
        return;
      }

      nogEens(100);
    };

    // Zonder de juiste letters klopt geen enkele meting
    const fonts = (document as any).fonts?.ready;
    if (fonts) fonts.then(() => nogEens(0));
    else nogEens(0);

    return () => {
      gestopt = true;
      clearTimeout(wacht);
    };
  });

  useEffect(() => {
    // Zijn de gegevens meegegeven, dan valt er niets op te halen
    if (givenTenant) return;

    fetch('/api/tenant')
      .then(res => (res.ok ? res.json() : null))
      .then(setFetchedTenant)
      .catch(() => setFetchedTenant(null))
      .finally(() => setIsLoadingTenant(false));
  }, [givenTenant]);

  const tenant = givenTenant ?? fetchedTenant;

  // Pas tonen als bekend is of er een eigen sjabloon is, anders flitst
  // eerst de standaardweergave voorbij
  if (isLoadingTenant) {
    return (
      <>
        <Skeleton height="2rem" width="35%" style={{ marginBottom: 'var(--space30)' }} />
        <Skeleton height="1rem" width="55%" style={{ marginBottom: 'var(--space10)' }} />
        <Skeleton height="1rem" width="45%" style={{ marginBottom: 'var(--space30)' }} />
        <Skeleton height="12rem" style={{ marginBottom: 'var(--space20)' }} />
        <Skeleton height="1rem" width="30%" style={{ marginLeft: 'auto' }} />
      </>
    );
  }

  const documentTotal = calculateDocumentTotal(blocks);

  // Het betaalblok van een factuur: zonder IBAN of bedrag toont het niets
  const paymentBlock =
    title === 'Factuur' && payment ? (
      <PaymentDetails
        payment={{
          name: tenant?.company_name || '',
          iban: tenant?.iban || '',
          amount: documentTotal,
          reference: payment.reference,
        }}
        dueDate={payment.dueDate}
      />
    ) : null;
  // Het eigen sjabloon van de aannemer, of anders het standaardsjabloon van Khance
  const template = documentTemplate(
    title,
    title === 'Offerte' ? tenant?.quote_template_html : tenant?.invoice_template_html
  );

  /** Welk vel er onder de muis ligt, op hoogte alleen: ze staan onder elkaar. */
  const velOnderMuis = (y: number): number | null => {
    const paginas = papierRef.current?.querySelectorAll<HTMLElement>('[data-blok-titel]');
    if (!paginas) return null;

    for (let i = 0; i < paginas.length; i++) {
      const r = paginas[i].getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return i;
    }

    return null;
  };

  const changeElement = (blok: number) => (element: number, changes: Partial<DocumentElement>) => {
    const block = blocks[blok];
    onChangeBlock?.(blok, {
      ...block,
      elements: block.elements.map((el, i) => (i === element ? { ...el, ...changes } : el)),
    });
  };

  const toon = (blok: number, onderdelen: { element: DocumentElement; index: number; van?: number; tot?: number }[]) => (
    <BlockView
      onderdelen={onderdelen}
      currency={currency}
      customer={customer}
      meta={meta}
      signature={signature}
      signatureField={signatureField}
      bewerkbaar={!!onSelect}
      edit={onChangeBlock ? { block: blok, onChange: changeElement(blok) } : undefined}
    />
  );

  /** De titel van een blok; in de editor een veld waarin je hem typt. */
  const blokTitel = (blok: number, as?: 'h2') => {
    const block = blocks[blok];

    if (!onChangeBlock) {
      if (!as) return block.title;
      return block.title ? <h2>{block.title}</h2> : null;
    }

    return (
      <EditableText
        as={as}
        field={fieldKeys.title(blok)}
        value={block.title}
        onFocus={() => {
          if (selected?.block !== blok) onSelect?.({ block: blok });
        }}
        onChange={(title) => onChangeBlock(blok, { ...block, title })}
      />
    );
  };

  // Alles wat op het papier bewerkt wordt, praat via dit kanaal terug
  const inlineEditing = {
    rememberCaret,
    select: (target: EditTarget) => onSelect?.(target),
    selected: selected ?? null,
    drag: {
      from: elementSleep?.from ?? null,
      over: elementSleep?.over ?? null,
      start: (from: EditTarget) => setElementSleep({ from, over: null }),
      hover: (over: EditTarget) => setElementSleep(huidig => (huidig ? { ...huidig, over } : huidig)),
      drop: (to: EditTarget) => {
        const from = elementSleep?.from;
        setElementSleep(null);
        if (!from || (from.block === to.block && from.element === to.element)) return;
        onMoveElement?.(from, to);
      },
      end: () => setElementSleep(null),
    },
  };

  // Eigen sjabloon van de aannemer: dat bepaalt de vormgeving, wij leveren
  // de inhoud op de plekken met data-slot
  if (template) {
    const values: Record<string, string> = {
      documenttitel: title,
      klant_naam: customer ? getCustomerDisplayName(customer) : '',
      klant_adres: customer?.street_address || '',
      klant_postcode_plaats: customer
        ? [customer.postal_code, customer.city].filter(Boolean).join(' ')
        : '',
      bedrijf_naam: tenant?.company_name || '',
      bedrijf_adres: tenant?.street_address || '',
      bedrijf_postcode_plaats: [tenant?.postal_code, tenant?.city].filter(Boolean).join(' '),
      bedrijf_email: tenant?.email || '',
      bedrijf_telefoon: tenant?.phone || '',
      bedrijf_kvk: tenant?.kvk || '',
      bedrijf_btw: tenant?.btw_number || '',
      bedrijf_iban: tenant?.iban || '',
      logo: tenant?.logo_url || '',
      totaal: formatCurrency(documentTotal, currency),
    };

    meta.forEach(row => {
      values[row.label.toLowerCase().replace(/\s+/g, '_')] = row.value;
    });

    // Eén pagina per blok, niet meer. Een extra vel om iets toe te voegen zou
    // ook bij de klant in de mail als lege pagina onder de offerte staan; de
    // knop daarvoor hoort onder het papier, niet erin.
    const slots: Record<string, React.ReactNode> = {
      totaal: <span>{formatCurrency(documentTotal, currency)}</span>,
      // Een sjabloon kiest zelf waar het betaalblok komt, met data-slot="betaling"
      betaling: paymentBlock,
    };

    const labels: Record<string, string> = {};

    // Eén slot per vel, niet per blok: een blok dat overloopt vult twee vellen
    // en krijgt op beide hetzelfde opschrift, met een doorlopend nummer
    vellen.forEach((vel, index) => {
      const block = blocks[vel.blok];
      if (!block) return;

      slots[`blok-${index}`] = toon(vel.blok, elementenVanVel(block, vel));
      slots[`bloktitel-${index}`] = blokTitel(vel.blok);
      labels[`blok-${index}`] = block.title || 'Blok';
      labels[`bloktitel-${index}`] = 'Titel';
    });

    // Op elk vel een handvat om het te verplaatsen. Een vel dat bij hetzelfde
    // blok hoort als het vorige is een vervolg; daar komt ook de knop om het
    // los te maken
    const overlays: Record<string, React.ReactNode> = {};
    if (onSelect) {
      vellen.forEach((vel, index) => {
        const vervolg = index > 0 && vellen[index - 1].blok === vel.blok;
        const begin = vel.stukken[0];

        // Begint dit vel midden in een prijstabel, dan valt er niets los te
        // maken: je zou twee tabellen krijgen met elk eigen subtotalen, en
        // dat is niet wat een doorlopende tabel hoort te doen
        const inTabel =
          !!begin &&
          begin.van !== undefined &&
          begin.van > 0 &&
          blocks[vel.blok]?.elements[begin.element]?.kind === 'prijstabel';
        const raakt =
          doelVel === index && sleeptVel !== null && vellen[sleeptVel]?.blok !== vel.blok;

        overlays[`blok-${index}`] = (
          <>
            <div className="sheet-actions">
              {onMoveBlock && (
                <span
                  className="drag-handle"
                  title="Sleep om deze pagina te verplaatsen"
                  aria-label="Pagina verplaatsen"
                  draggable
                  onClick={(event) => event.stopPropagation()}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    pakOp(index);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                  }}
                  onDragEnd={() => pakOp(null)}
                >
                  <GripVertical size={16} />
                </span>
              )}

              {vervolg && begin && !inTabel && onSplitBlock && (
                <button
                  type="button"
                  className="button add-item"
                  title="Zet het vervolg in een eigen blok, zodat je het apart kunt bewerken"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSplitBlock(vel.blok, begin);
                  }}
                >
                  Losmaken als eigen blok
                </button>
              )}
            </div>

            {raakt && <div className="sheet-drop-mark" />}
          </>
        );
      });
    }

    const actiefVel = selected ? vellen.findIndex(vel => vel.blok === selected.block) : -1;

    return (
      <InlineEditContext.Provider value={inlineEditing}>
        <div className="document-window" ref={vensterRef}>
          <div
            // Liggend A4 voor het standaardsjabloon; een eigen sjabloon kiest zelf
            className={`document-paper${tenant?.paper_orientation === 'landscape' ? ' landscape' : ''}`}
            ref={papierRef}
            onDragOver={
              onMoveBlock
                ? (event) => {
                    if (sleept.current === null) return;

                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';

                    const onder = velOnderMuis(event.clientY);
                    if (onder !== null && onder !== doelVel) setDoelVel(onder);
                  }
                : undefined
            }
            onDrop={
              onMoveBlock
                ? (event) => {
                    event.preventDefault();

                    const onder = velOnderMuis(event.clientY);
                    const opgepakt = sleept.current;
                    const van = opgepakt === null ? undefined : vellen[opgepakt]?.blok;
                    const naar = onder === null ? undefined : vellen[onder]?.blok;

                    // Een vel van hetzelfde blok is geen verplaatsing
                    if (van !== undefined && naar !== undefined && van !== naar) onMoveBlock(van, naar);

                    pakOp(null);
                  }
                : undefined
            }
            data-indeling={indelingKlaar ? 'klaar' : 'bezig'}
            style={papier === 'vol' ? undefined : { transform: `scale(${schaal})`, width: `${100 / schaal}%` }}
          >
        <TemplatedDocument
          html={template}
          values={values}
          labels={labels}
          activeSlot={actiefVel < 0 ? null : `blok-${actiefVel}`}
          // Alleen tijdens het bewerken; anders krijgt de klant op zijn eigen
          // offertepagina de omlijning en het label van een bewerkbaar vlak
          onSelect={
            onSelect
              ? (slot) => {
                  const match = slot.match(/^(blok|bloktitel)-(\d+)$/);
                  if (!match) return;

                  // Een klik op een vervolgvel bewerkt gewoon het blok zelf
                  const vel = vellen[Number(match[2])];
                  if (!vel || vel.blok >= blocks.length) return;

                  // Wie in een veld klikte heeft zijn element al gekozen
                  if (selected?.block !== vel.blok) onSelect({ block: vel.blok });

                  // Een lege titel is te smal om in te klikken; een klik ernaast
                  // zet de cursor er toch in
                  const titelVeld = fieldKeys.title(vel.blok);
                  if (match[1] === 'bloktitel' && onChangeBlock && (document.activeElement as HTMLElement | null)?.dataset?.bewerk !== titelVeld) {
                    restoreCaret(papierRef.current!, { field: titelVeld, node: 0, offset: blocks[vel.blok].title.length });
                  }
                }
              : undefined
          }
          onLayout={meetMeteen}
          repeatCounts={{ blok: vellen.length }}
          repeatTitles={vellen.map(vel => blocks[vel.blok]?.title ?? '')}
          slots={slots}
          overlays={overlays}
        />
          </div>
        </div>

        {onAddBlock && (
          <div className="add-block-footer">
            <button type="button" className="button add-item" onClick={() => onAddBlock(blocks.length)}>
              + Blok
            </button>
          </div>
        )}
      </InlineEditContext.Provider>
    );
  }

  // Zonder eigen sjabloon een kale weergave: de opmaak hoort in het
  // sjabloon te staan dat de aannemer bij Instellingen invult
  return (
    <InlineEditContext.Provider value={inlineEditing}>
      <div ref={kaleWeergaveRef}>
      {tenant?.logo_url && (
        <img src={tenant.logo_url} alt={tenant.company_name || ''} style={{ maxWidth: '200px' }} />
      )}

      <h1>{title}</h1>

      {blocks.map((block, index) => (
        <div key={index}>
          {onAddBlock && <AddBlockDivider onAdd={() => onAddBlock(index)} />}

          <div
            className={onSelect ? `editable-region${selected?.block === index ? ' active' : ''}` : undefined}
            data-label={block.title || 'Blok'}
            onClick={
              onSelect
                ? (event) => {
                    event.stopPropagation();
                    // Een klik in een element kiest dat element al zelf
                    if (!(event.target as HTMLElement).closest('[data-element], [data-bewerk]')) onSelect({ block: index });
                  }
                : undefined
            }
          >
            {blokTitel(index, 'h2')}
            {toon(index, block.elements.map((element, i) => ({ element, index: i })))}
          </div>
        </div>
      ))}

      {onAddBlock && <AddBlockDivider onAdd={() => onAddBlock(blocks.length)} />}

      {/* Elke prijstabel toont zijn eigen totaal; een eindtotaal heeft pas zin
          als er meer dan één is */}
      {allPriceTables(blocks).length > 1 && (
        <div className="invoice-total">
          <div className="invoice-total-row total-final">
            <span>Totale prijs</span>
            <span>{formatCurrency(documentTotal, currency)}</span>
          </div>
        </div>
      )}

      {paymentBlock}
      </div>
    </InlineEditContext.Provider>
  );
}
