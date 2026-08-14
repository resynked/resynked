import { useEffect, useState } from 'react';
import TemplatedDocument from '@/components/TemplatedDocument';
import { Skeleton } from '@/components/Skeleton';
import type { Customer, DocumentBlock, DocumentElement, Tenant } from '@/lib/supabase';
import {
  calculateDocumentTotal,
  calculateElementTotals,
  formatCurrency,
  getCustomerDisplayName,
  lineTotal,
} from '@/lib/utils';

interface DocumentPreviewProps {
  title: 'Offerte' | 'Factuur';
  /** Regels bij het gegevens-element, bijvoorbeeld nummer en datums */
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  blocks: DocumentBlock[];
  currency?: string;
  /** Welk blok op dit moment bewerkt wordt */
  activeBlock?: number | null;
  /** Aangeroepen bij een klik op een blok in het document */
  onSelectBlock?: (index: number) => void;
  /** Voegt een blok toe op een bepaalde plek in de lijst */
  onAddBlock?: (atIndex: number) => void;
}

/**
 * Zet tekst om naar opmaak: een regel die met ## begint wordt een kop,
 * een regel die met - begint een opsomming, de rest een alinea.
 */
export function FormattedText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key}>
        {bullets.map((bullet, i) => (
          <li key={i}>{bullet}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2));
      return;
    }

    flushBullets(`ul-${index}`);

    if (trimmed.startsWith('## ')) {
      blocks.push(<h3 key={index}>{trimmed.slice(3)}</h3>);
    } else if (trimmed) {
      blocks.push(<p key={index}>{trimmed}</p>);
    }
  });

  flushBullets('ul-last');

  return <>{blocks}</>;
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
  customer?: Customer | null;
  meta: { label: string; value: string }[];
}

/** Alles wat er in één blok staat, in volgorde. */
function BlockView({ block, currency, customer, meta }: BlockViewProps) {
  if (block.elements.length === 0) {
    return <p>Nog leeg. Klik hier om er tekst of een prijstabel in te zetten.</p>;
  }

  return (
    <>
      {block.elements.map((element, index) => (
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

              <div className="document-meta">
                {meta
                  .filter(row => row.value)
                  .map(row => (
                    <div key={row.label}>
                      {row.label}: {row.value}
                    </div>
                  ))}
              </div>
            </>
          )}

          {element.kind === 'kop' && <h2>{element.body || 'Kop toevoegen'}</h2>}

          {element.kind === 'tekst' &&
            (element.body ? <FormattedText text={element.body} /> : <p>Tekst toevoegen</p>)}

          {element.kind === 'prijstabel' && <PriceTable element={element} currency={currency} />}
        </div>
      ))}
    </>
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
  activeBlock,
  onSelectBlock,
  onAddBlock,
}: DocumentPreviewProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  useEffect(() => {
    fetch('/api/tenant')
      .then(res => (res.ok ? res.json() : null))
      .then(setTenant)
      .catch(() => setTenant(null))
      .finally(() => setIsLoadingTenant(false));
  }, []);

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
    <BlockView block={blocks[index]} currency={currency} customer={customer} meta={meta} />
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

    // Eén pagina per blok, plus een lege om er een toe te voegen
    const slots: Record<string, React.ReactNode> = {
      totaal: <span>{formatCurrency(documentTotal, currency)}</span>,
    };

    const labels: Record<string, string> = {};

    blocks.forEach((block, index) => {
      slots[`blok-${index}`] = blokInhoud(index);
      slots[`bloktitel-${index}`] = block.title;
      labels[`blok-${index}`] = block.title || 'Blok';
    });

    if (onAddBlock) {
      slots[`blok-${blocks.length}`] = <AddBlockDivider onAdd={() => onAddBlock(blocks.length)} />;
      labels[`blok-${blocks.length}`] = 'Nieuw blok';
    }

    return (
      <TemplatedDocument
        html={template}
        values={values}
        labels={labels}
        activeSlot={activeBlock === null || activeBlock === undefined ? null : `blok-${activeBlock}`}
        onSelect={(slot) => {
          const match = slot.match(/^blok-(\d+)$/);
          if (!match || !onSelectBlock) return;

          const index = Number(match[1]);
          if (index < blocks.length) onSelectBlock(index);
        }}
        repeatCounts={{ blok: blocks.length + 1 }}
        repeatTitles={blocks.map(block => block.title)}
        slots={slots}
      />
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
