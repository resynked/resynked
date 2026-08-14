import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import LineItems, { emptyLineItem } from '@/components/LineItems';
import DocumentPreview from '@/components/DocumentPreview';
import type { Customer, LineItem } from '@/lib/supabase';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const taxOptions = [
  { value: '0', label: '0%' },
  { value: '9', label: '9%' },
  { value: '21', label: '21%' },
];

const discountOptions = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

export default function NewInvoice() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    items: [emptyLineItem()] as LineItem[],
    tax_percentage: 21,
    discount_percentage: 0,
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, customer_id: String(data[0].id) }));
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const selectedCustomer = customers.find(c => String(c.id) === formData.customer_id);

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: getCustomerDisplayName(c),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_id) {
      setError('Selecteer een klant');
      return;
    }

    if (formData.items.length === 0 || formData.items.some(item => !item.description.trim())) {
      setError('Elke regel heeft een omschrijving nodig');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          customer_id: formData.customer_id,
          currency: formData.currency,
          tax_percentage: formData.tax_percentage,
          discount_percentage: formData.discount_percentage,
          notes: formData.notes || null,
          status: 'draft',
          items: formData.items,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/invoices');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="header">
        <h1>Nieuwe factuur aanmaken</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/invoices')}>
            Annuleren
          </button>
          <button type="submit" form="invoice-form" className="button" disabled={isLoading}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="block">
          <form id="invoice-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="invoice_date">Factuurdatum</label>
                  <input
                    id="invoice_date"
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="due_date">Vervaldatum</label>
                  <input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Klantgegevens</h3>
              <div className="form-group">
                <Select
                  value={customerOptions.find(o => o.value === formData.customer_id) || null}
                  onChange={(option) => setFormData({ ...formData, customer_id: option?.value || '' })}
                  options={customerOptions}
                  placeholder="Selecteer klant..."
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Werkzaamheden en materialen</h3>

              <div className="form-group">
                <label>Valuta</label>
                <Select
                  value={currencyOptions.find(o => o.value === formData.currency) || null}
                  onChange={(option) => setFormData({ ...formData, currency: option?.value || 'EUR' })}
                  options={currencyOptions}
                />
              </div>

              <LineItems
                items={formData.items}
                onChange={(items) => setFormData({ ...formData, items })}
              />
            </div>

            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tax">BTW percentage</label>
                  <Select
                    value={taxOptions.find(o => o.value === String(formData.tax_percentage)) || null}
                    onChange={(option) => setFormData({ ...formData, tax_percentage: Number(option?.value ?? 21) })}
                    options={taxOptions}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discount">Kortingspercentage</label>
                  <Select
                    value={discountOptions.find(o => o.value === String(formData.discount_percentage)) || null}
                    onChange={(option) => setFormData({ ...formData, discount_percentage: Number(option?.value ?? 0) })}
                    options={discountOptions}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="notes">Opmerkingen</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Eventuele opmerkingen..."
                  rows={4}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="block">
          <DocumentPreview
            title="Factuur"
            meta={[
              { label: 'Factuurnummer', value: 'Wordt automatisch toegekend' },
              { label: 'Factuurdatum', value: formatDate(formData.invoice_date) },
              { label: 'Vervaldatum', value: formatDate(formData.due_date) },
            ]}
            customer={selectedCustomer}
            items={formData.items}
            currency={formData.currency}
            taxPercentage={formData.tax_percentage}
            discountPercentage={formData.discount_percentage}
            notes={formData.notes}
          />
        </div>
      </div>
    </Layout>
  );
}
