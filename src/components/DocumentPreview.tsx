import { Fragment } from 'react';
import type { Customer, DocumentBlock } from '@/lib/supabase';
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
}

/**
 * Zet een tekstblok om naar opmaak: een regel die met ## begint wordt een
 * kop, een regel die met - begint een opsomming, de rest een alinea.
 */
function FormattedText({ text }: { text: string }) {
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

/** Papieren weergave van een offerte of factuur, zoals de klant hem krijgt. */
export default function DocumentPreview({
  title,
  meta,
  customer,
  blocks,
  currency = 'EUR',
  introText,
  notes,
}: DocumentPreviewProps) {
  const priceBlocks = blocks.filter(block => block.kind !== 'tekst');
  const documentTotal = calculateDocumentTotal(blocks);

  return (
    <div className="invoice-preview">
      <div className="invoice-company-header">
        <div className="invoice-company-logo">Bedrijfslogo</div>
        <div className="invoice-company-info">
          <div>Uw bedrijfsnaam</div>
          <div>Straatnaam 1</div>
          <div>1200 AC Amsterdam</div>
          <div>KvK: 12345678</div>
          <div>BTW: NL123456789B01</div>
          <div>Bank: NL55 BANK 0123 4567 89</div>
        </div>
      </div>

      {customer && (
        <div className="invoice-customer-info">
          <div>{getCustomerDisplayName(customer)}</div>
          {customer.street_address && <div>{customer.street_address}</div>}
          {(customer.postal_code || customer.city) && (
            <div>{[customer.postal_code, customer.city].filter(Boolean).join(' ')}</div>
          )}
          {customer.btw_number && <div>BTW: {customer.btw_number}</div>}
        </div>
      )}

      <h1 className="invoice-title">{title}</h1>

      <div className="invoice-data">
        {meta
          .filter(row => row.value)
          .map(row => (
            <div key={row.label}>
              {row.label}: {row.value}
            </div>
          ))}
      </div>

      {introText && (
        <div className="invoice-notes">
          <FormattedText text={introText} />
        </div>
      )}

      {blocks.map((block, blockIndex) => {
        if (block.kind === 'tekst') {
          return (
            <div key={blockIndex} className="invoice-notes">
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
          <Fragment key={blockIndex}>
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
          </Fragment>
        );
      })}

      {priceBlocks.length > 1 && (
        <div className="invoice-total">
          <div className="invoice-total-row total-final">
            <span>Totale prijs</span>
            <span>{formatCurrency(documentTotal, currency)}</span>
          </div>
        </div>
      )}

      {notes && (
        <div className="invoice-notes">
          <strong>Opmerkingen:</strong>
          <p>{notes}</p>
        </div>
      )}
    </div>
  );
}
