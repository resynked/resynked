import { useEffect, useState } from 'react';
import TemplatedDocument from '@/components/TemplatedDocument';
import { Skeleton } from '@/components/Skeleton';
import type { Customer, DocumentBlock, Tenant } from '@/lib/supabase';
import {
  calculateBlockTotals,
  calculateDocumentTotal,
  formatCurrency,
  getCustomerDisplayName,
  lineTotal,
} from '@/lib/utils';

interface DocumentPreviewProps {
  title: 'Offerte' | 'Factuur';
  /** Regels boven de blokken, bijvoorbeeld nummer en datums */
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  blocks: DocumentBlock[];
  currency?: string;
  introText?: string;
  notes?: string;
  /** Welk onderdeel op dit moment bewerkt wordt */
  activeSlot?: string | null;
  /** Aangeroepen als er in het document op een onderdeel geklikt wordt */
  onSelect?: (slot: string) => void;
}

/** Elk aanklikbaar onderdeel hoort bij een paneel met de bijbehorende velden. */
export const SLOT_PANELS: Record<string, string> = {
  klantgegevens: 'customer',
  kenmerken: 'details',
  brief: 'intro',
  blokken: 'blocks',
  tekstblokken: 'blocks',
  prijsblokken: 'blocks',
  totaal: 'blocks',
  opmerkingen: 'notes',
};

/**
 * Zet een tekstblok om naar opmaak: een regel die met ## begint wordt een
 * kop, een regel die met - begint een opsomming, de rest een alinea.
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

/** De blokken met hun regels en subtotalen. Wordt in beide weergaven gebruikt. */
function BlocksView({ blocks, currency }: { blocks: DocumentBlock[]; currency: string }) {
  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.kind === 'tekst') {
          return (
            <div key={blockIndex} data-block="tekst" data-block-title={block.title}>
              {block.title && <h3>{block.title}</h3>}
              {block.body && <FormattedText text={block.body} />}
            </div>
          );
        }

        const totals = calculateBlockTotals(block);

        // Aantal en eenheid alleen tonen als ze in dit blok gebruikt worden
        const showQuantity = block.items.some(
          item => !item.is_heading && (item.unit || Number(item.quantity) !== 1)
        );

        return (
          <div
            key={blockIndex}
            data-block="prijsopgave"
            data-block-title={block.title}
            data-block-tax={block.tax_percentage}
          >
            {block.title && <h3>{block.title} (btw {block.tax_percentage}%)</h3>}

            {block.items.length > 0 && (
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
                    {block.items.map((item, itemIndex) =>
                      item.is_heading ? (
                        <tr key={itemIndex}>
                          <td colSpan={showQuantity ? 4 : 2}>
                            <strong>{item.description}</strong>
                          </td>
                        </tr>
                      ) : (
                        <tr key={itemIndex}>
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
              {block.discount_percentage > 0 && (
                <div className="invoice-total-row">
                  <span>Korting ({block.discount_percentage}%)</span>
                  <span>- {formatCurrency(totals.discount, currency)}</span>
                </div>
              )}
              <div className="invoice-total-row">
                <span>BTW ({block.tax_percentage}%)</span>
                <span>{formatCurrency(totals.tax, currency)}</span>
              </div>
              <div className="invoice-total-row total-final">
                <span>Totaal incl. btw</span>
                <span>{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Papieren weergave van een offerte of factuur, zoals de klant hem krijgt. */
export default function DocumentPreview({
  title,
  meta,
  customer,
  blocks,
  currency = 'EUR',
  introText,
  notes,
  activeSlot,
  onSelect,
}: DocumentPreviewProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  const labels: Record<string, string> = {
    klantgegevens: 'Klant',
    kenmerken: title === 'Offerte' ? 'Offertegegevens' : 'Factuurgegevens',
    brief: 'Begeleidende tekst',
    blokken: 'Blokken',
    tekstblokken: 'Blokken',
    prijsblokken: 'Blokken',
    totaal: 'Blokken',
    opmerkingen: 'Opmerkingen',
  };

  /** Maakt een onderdeel van het document aanklikbaar om te bewerken. */
  const Region = ({ slot, children }: { slot: string; children: React.ReactNode }) => {
    if (!onSelect) return <>{children}</>;

    return (
      <div
        className={`editable-region${activeSlot === slot ? ' active' : ''}`}
        data-label={labels[slot] || slot}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(slot);
        }}
      >
        {children}
      </div>
    );
  };

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

  const priceBlocks = blocks.filter(block => block.kind !== 'tekst');
  const documentTotal = calculateDocumentTotal(blocks);

  const customerLines = customer
    ? [
        getCustomerDisplayName(customer),
        customer.street_address,
        [customer.postal_code, customer.city].filter(Boolean).join(' '),
      ].filter(Boolean)
    : [];

  const template = title === 'Offerte' ? tenant?.quote_template_html : tenant?.invoice_template_html;

  // Eigen sjabloon van de aannemer: dat bepaalt de vormgeving, wij leveren
  // de inhoud aan op de plekken met data-slot
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

    return (
      <TemplatedDocument
        html={template}
        values={values}
        labels={labels}
        activeSlot={activeSlot}
        onSelect={onSelect}
        slots={{
          klantgegevens: (
            <>
              {customerLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </>
          ),
          kenmerken: (
            <>
              {meta
                .filter(row => row.value)
                .map(row => (
                  <div key={row.label}>
                    {row.label}: {row.value}
                  </div>
                ))}
            </>
          ),
          brief: introText ? <FormattedText text={introText} /> : null,
          blokken: <BlocksView blocks={blocks} currency={currency} />,
          // Losse slots zodat een sjabloon de werkomschrijving en de
          // prijsopgave op eigen pagina's kan zetten
          tekstblokken: (
            <BlocksView blocks={blocks.filter(b => b.kind === 'tekst')} currency={currency} />
          ),
          prijsblokken: <BlocksView blocks={priceBlocks} currency={currency} />,
          totaal: <span>{formatCurrency(documentTotal, currency)}</span>,
          opmerkingen: notes ? <p>{notes}</p> : null,
          voorwaarden: tenant?.quote_conditions ? (
            <FormattedText text={tenant.quote_conditions} />
          ) : null,
          algemene_voorwaarden: tenant?.terms_and_conditions ? (
            <FormattedText text={tenant.terms_and_conditions} />
          ) : null,
        }}
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

      <Region slot="klantgegevens">
        {customerLines.length > 0 ? (
          customerLines.map((line, i) => <div key={i}>{line}</div>)
        ) : (
          <div>Nog geen klant gekozen</div>
        )}
      </Region>

      <h1>{title}</h1>

      <Region slot="kenmerken">
        {meta
          .filter(row => row.value)
          .map(row => (
            <div key={row.label}>
              {row.label}: {row.value}
            </div>
          ))}
      </Region>

      <Region slot="brief">
        {introText ? <FormattedText text={introText} /> : <p>Begeleidende tekst toevoegen</p>}
      </Region>

      <Region slot="blokken">
        <BlocksView blocks={blocks} currency={currency} />

        {priceBlocks.length > 1 && (
          <div className="invoice-total">
            <div className="invoice-total-row total-final">
              <span>Totale prijs</span>
              <span>{formatCurrency(documentTotal, currency)}</span>
            </div>
          </div>
        )}
      </Region>

      <Region slot="opmerkingen">
        <strong>Opmerkingen</strong>
        <p>{notes || 'Opmerkingen toevoegen'}</p>
      </Region>
    </>
  );
}
