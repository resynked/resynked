import type { Customer, LineItem } from '@/lib/supabase';
import { calculateTotals, formatCurrency, getCustomerDisplayName } from '@/lib/utils';

interface DocumentPreviewProps {
  title: 'Offerte' | 'Factuur';
  /** Regels boven de tabel, bijvoorbeeld nummer en datums */
  meta: { label: string; value: string }[];
  customer?: Customer | null;
  items: LineItem[];
  currency?: string;
  taxPercentage: number;
  discountPercentage: number;
  notes?: string;
}

/** Papieren weergave van een offerte of factuur, zoals de klant hem krijgt. */
export default function DocumentPreview({
  title,
  meta,
  customer,
  items,
  currency = 'EUR',
  taxPercentage,
  discountPercentage,
  notes,
}: DocumentPreviewProps) {
  const { subtotal, discount, tax, total } = calculateTotals(items, taxPercentage, discountPercentage);

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

      {items.length > 0 && (
        <div className="table-container">
          <table className="product-table">
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th>Aantal</th>
                <th>Eenheid</th>
                <th>Prijs</th>
                <th>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{formatCurrency(item.price, currency)}</td>
                  <td>{formatCurrency(item.quantity * item.price, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="invoice-total">
          <div className="invoice-total-row">
            <span>Subtotaal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {discountPercentage > 0 && (
            <div className="invoice-total-row">
              <span>Korting ({discountPercentage}%)</span>
              <span>- {formatCurrency(discount, currency)}</span>
            </div>
          )}
          <div className="invoice-total-row">
            <span>BTW ({taxPercentage}%)</span>
            <span>{formatCurrency(tax, currency)}</span>
          </div>
          <div className="invoice-total-row total-final">
            <span>Totaal</span>
            <span>{formatCurrency(total, currency)}</span>
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
