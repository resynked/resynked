import { useEffect, useState } from 'react';
import TemplatedDocument from '@/components/TemplatedDocument';
import { Skeleton } from '@/components/Skeleton';
import type { Customer, DocumentBlock, DocumentElement, Tenant } from '@/lib/supabase';
import { isRichTextEmpty, toDisplayHtml } from '@/lib/richtext';
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
}

/**
 * De tekst van een tekstelement, met zijn opmaak.
 *
 * Wat de editor oplevert is HTML; een tekst van vóór de editor staat als platte
 * tekst in de database en wordt omgezet. Beide gaan langs de opschoning van
 * richtext. De opmaak hangt aan het element zelf, zodat er geen tweede div om
 * heen komt: die hoort bij het blok en niet bij de tekst.
 */
function TextElement({ body }: { body: string | null }) {
  if (!body || isRichTextEmpty(body)) {
    return (
      <div data-element="tekst" className="rich-text">
        <p>Tekst toevoegen</p>
      </div>
    );
  }

  return (
    <div
      data-element="tekst"
      className="rich-text"
      dangerouslySetInnerHTML={{ __html: toDisplayHtml(body) }}
    />
  );
}

/** De tabel met regels en de subtotalen van één prijstabel. */
function PriceTable({ element, currency }: { element: DocumentElement; currency: string }) {
  const totals = calculateElementTotals(element);

  // Aantal en eenheid alleen tonen als ze in deze tabel gebruikt worden
  const showQuantity = element.items.some(
    item => !item.is_heading && (item.unit || Number(item.quantity) !== 1)
  );

  return (
    <>
      {element.items.length > 0 && (
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
              {element.items.map((item, index) =>
                item.is_heading ? (
                  <tr key={index}>
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
                )
              )}
            </tbody>
          </table>
        </div>
      )}

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
    </>
  );
}

interface BlockViewProps {
  block: DocumentBlock;
  currency: string;
  customer?: Partial<Customer> | null;
  meta: { label: string; value: string }[];
  signature?: SignatureState | null;
  signatureField?: React.ReactNode;
}

/** Alles wat er in één blok staat, in volgorde. */
function BlockView({ block, currency, customer, meta, signature, signatureField }: BlockViewProps) {
  if (block.elements.length === 0) {
    return <p>Nog leeg. Klik hier om er tekst of een prijstabel in te zetten.</p>;
  }

  return (
    <>
      {block.elements.map((element, index) =>
        element.kind === 'tekst' ? (
          <TextElement key={index} body={element.body} />
        ) : (
        <div key={index} data-element={element.kind}>
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
                  <div>Nog geen klant gekozen</div>
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

          {element.kind === 'kop' && <h2>{element.body || 'Kop toevoegen'}</h2>}

          {element.kind === 'handtekening' && (
            <SignatureElement signature={signature} field={signatureField} />
          )}

          {element.kind === 'prijstabel' && <PriceTable element={element} currency={currency} />}
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
}: DocumentPreviewProps) {
  const [fetchedTenant, setFetchedTenant] = useState<Tenant | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(!givenTenant);

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

  const blokInhoud = (index: number) => (
    <BlockView
      block={blocks[index]}
      currency={currency}
      customer={customer}
      meta={meta}
      signature={signature}
      signatureField={signatureField}
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

    blocks.forEach((block, index) => {
      slots[`blok-${index}`] = blokInhoud(index);
      slots[`bloktitel-${index}`] = block.title;
      labels[`blok-${index}`] = block.title || 'Blok';
    });

    return (
      <>
        <TemplatedDocument
          html={template}
          values={values}
          labels={labels}
          activeSlot={activeBlock === null || activeBlock === undefined ? null : `blok-${activeBlock}`}
          // Alleen tijdens het bewerken; anders krijgt de klant op zijn eigen
          // offertepagina de omlijning en het label van een bewerkbaar vlak
          onSelect={
            onSelectBlock
              ? (slot) => {
                  const match = slot.match(/^blok-(\d+)$/);
                  if (!match) return;

                  const index = Number(match[1]);
                  if (index < blocks.length) onSelectBlock(index);
                }
              : undefined
          }
          repeatCounts={{ blok: blocks.length }}
          repeatTitles={blocks.map(block => block.title)}
          slots={slots}
        />

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
            {blokInhoud(index)}
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
