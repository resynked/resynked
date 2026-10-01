import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import TemplatedDocument from '@/components/TemplatedDocument';
import { Skeleton } from '@/components/Skeleton';
import type { Customer, DocumentBlock, DocumentElement, Tenant } from '@/lib/supabase';
import { isRichTextEmpty, toDisplayHtml } from '@/lib/richtext';
import {
  eersteIndeling,
  elementenVanVel,
  gelijkeIndeling,
  knipVel,
  snijTekst,
  type Knip,
  type Stuk,
  type Vel,
} from '@/lib/pagination';
import {
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
   * Wat er op de plek van het handtekening-element komt zolang er niet getekend
   * is. De offertepagina van de klant zet hier het tekenvak neer; in de app
   * blijft dit leeg en staan er lijnen.
   */
  signatureField?: React.ReactNode;
  /** Welk blok op dit moment bewerkt wordt */
  activeBlock?: number | null;
  /** Aangeroepen bij een klik op een blok in het document */
  onSelectBlock?: (index: number) => void;
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
}: {
  element: DocumentElement;
  currency: string;
  van?: number;
  tot?: number;
}) {
  const totals = calculateElementTotals(element);

  // De totalen gaan over de hele tabel, ook als er maar een deel op dit vel staat
  const totalenIndex = element.items.length;
  const vanaf = van ?? 0;
  const totEn = tot ?? totalenIndex + 1;
  const regels = element.items.slice(vanaf, Math.min(totEn, totalenIndex));
  const toonTotalen = totEn > totalenIndex;

  // Aantal en eenheid alleen tonen als ze in deze tabel gebruikt worden
  const showQuantity = element.items.some(
    item => !item.is_heading && (item.unit || Number(item.quantity) !== 1)
  );

  return (
    <>
      {regels.length > 0 && (
        <div className="table-container">
          <table className="product-table">
            <thead>
              <tr>
                <th>Omschrijving</th>
                {showQuantity && <th>Aantal</th>}
                {showQuantity && <th>Eenheid</th>}
                <th>Bedrag excl. btw</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((item, regelIndex) => {
                const index = vanaf + regelIndex;
                return item.is_heading ? (
                  <tr key={index} data-kop="1">
                    <td colSpan={showQuantity ? 4 : 2}>
                      <strong>{item.description}</strong>
                    </td>
                  </tr>
                ) : (
                  <tr key={index}>
                    <td>{item.description}</td>
                    {showQuantity && <td>{item.quantity}</td>}
                    {showQuantity && <td>{item.unit || ''}</td>}
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
  onderdelen: { element: DocumentElement; van?: number; tot?: number }[];
  currency: string;
  customer?: Partial<Customer> | null;
  meta: { label: string; value: string }[];
  signature?: SignatureState | null;
  signatureField?: React.ReactNode;
  /** In de editor staan er hints bij lege onderdelen; in het document niet */
  bewerkbaar: boolean;
}

/** Alles wat er in één blok staat, in volgorde. */
function BlockView({ onderdelen, currency, customer, meta, signature, signatureField, bewerkbaar }: BlockViewProps) {
  if (onderdelen.length === 0) {
    return bewerkbaar ? <p>Nog leeg. Klik hier om er tekst of een prijstabel in te zetten.</p> : null;
  }

  return (
    <>
      {onderdelen.map(({ element, van, tot }, index) =>
        element.kind === 'tekst' ? (
          <TextElement key={index} body={element.body} bewerkbaar={bewerkbaar} stuk={index} van={van} tot={tot} />
        ) : (
        <div key={index} data-element={element.kind} data-stuk={index} data-van={van ?? 0}>
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

          {element.kind === 'handtekening' && (
            <SignatureElement signature={signature} field={signatureField} />
          )}

          {element.kind === 'prijstabel' && (
            <PriceTable element={element} currency={currency} van={van} tot={tot} />
          )}
        </div>
        )
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
      const knopen = Array.from(el.children);
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
  signatureField,
  activeBlock,
  onSelectBlock,
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

  // Verandert er iets aan de offerte, dan begint het opdelen opnieuw. Anders
  // zou een verwijderde alinea een leeg vel achterlaten
  const blokkenSleutel = JSON.stringify(blocks);
  useEffect(() => {
    setVellen(eersteIndeling(blocks));
    setIndelingKlaar(false);
    rondes.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blokkenSleutel]);

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
  const template = title === 'Offerte' ? tenant?.quote_template_html : tenant?.invoice_template_html;

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

  const toon = (onderdelen: { element: DocumentElement; van?: number; tot?: number }[]) => (
    <BlockView
      onderdelen={onderdelen}
      currency={currency}
      customer={customer}
      meta={meta}
      signature={signature}
      signatureField={signatureField}
      bewerkbaar={!!onSelectBlock}
    />
  );

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
    };

    const labels: Record<string, string> = {};

    // Eén slot per vel, niet per blok: een blok dat overloopt vult twee vellen
    // en krijgt op beide hetzelfde opschrift, met een doorlopend nummer
    vellen.forEach((vel, index) => {
      const block = blocks[vel.blok];
      if (!block) return;

      slots[`blok-${index}`] = toon(elementenVanVel(block, vel));
      slots[`bloktitel-${index}`] = block.title;
      labels[`blok-${index}`] = block.title || 'Blok';
    });

    // Op elk vel een handvat om het te verplaatsen. Een vel dat bij hetzelfde
    // blok hoort als het vorige is een vervolg; daar komt ook de knop om het
    // los te maken
    const overlays: Record<string, React.ReactNode> = {};
    if (onSelectBlock) {
      vellen.forEach((vel, index) => {
        const vervolg = index > 0 && vellen[index - 1].blok === vel.blok;
        const begin = vel.stukken[0];
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

              {vervolg && begin && onSplitBlock && (
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

    const actiefVel = activeBlock === null || activeBlock === undefined
      ? -1
      : vellen.findIndex(vel => vel.blok === activeBlock);

    return (
      <>
        <div className="document-window" ref={vensterRef}>
          <div
            className="document-paper"
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
            onSelectBlock
              ? (slot) => {
                  const match = slot.match(/^blok-(\d+)$/);
                  if (!match) return;

                  // Een klik op een vervolgvel bewerkt gewoon het blok zelf
                  const vel = vellen[Number(match[1])];
                  if (vel && vel.blok < blocks.length) onSelectBlock(vel.blok);
                }
              : undefined
          }
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
      </>
    );
  }

  // Zonder eigen sjabloon een kale weergave: de opmaak hoort in het
  // sjabloon te staan dat de aannemer bij Instellingen invult
  return (
    <>
      {tenant?.logo_url && (
        <img src={tenant.logo_url} alt={tenant.company_name || ''} style={{ maxWidth: '200px' }} />
      )}

      <h1>{title}</h1>

      {blocks.map((block, index) => (
        <div key={index}>
          {onAddBlock && <AddBlockDivider onAdd={() => onAddBlock(index)} />}

          <div
            className={onSelectBlock ? `editable-region${activeBlock === index ? ' active' : ''}` : undefined}
            data-label={block.title || 'Blok'}
            onClick={
              onSelectBlock
                ? (event) => {
                    event.stopPropagation();
                    onSelectBlock(index);
                  }
                : undefined
            }
          >
            {block.title && <h2>{block.title}</h2>}
            {toon(block.elements.map(element => ({ element })))}
          </div>
        </div>
      ))}

      {onAddBlock && <AddBlockDivider onAdd={() => onAddBlock(blocks.length)} />}

      <div className="invoice-total">
        <div className="invoice-total-row total-final">
          <span>Totale prijs</span>
          <span>{formatCurrency(documentTotal, currency)}</span>
        </div>
      </div>
    </>
  );
}
