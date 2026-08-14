import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import LineItems from '@/components/LineItems';
import DocumentPreview from '@/components/DocumentPreview';
import type { Customer, LineItem } from '@/lib/supabase';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';
import { useConfirm } from '@/hooks/useConfirm';

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

const statusOptions = [
  { value: 'draft', label: 'Concept' },
  { value: 'sent', label: 'Verzonden' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'rejected', label: 'Afgewezen' },
  { value: 'expired', label: 'Verlopen' },
];

export default function EditQuote() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const { id } = router.query;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [convertedInvoiceId, setConvertedInvoiceId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    quote_number: '',
    quote_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    status: 'draft',
    items: [] as LineItem[],
    tax_percentage: 21,
    discount_percentage: 0,
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchQuote();
    fetchCustomers();
  }, [id]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${id}`);
      if (!response.ok) {
        setError('Offerte niet gevonden');
        return;
      }

      const quote: any = await response.json();

      setConvertedInvoiceId(quote.converted_to_invoice_id || null);
      setFormData({
        quote_number: quote.quote_number || '',
        quote_date: quote.quote_date || new Date().toISOString().split('T')[0],
        valid_until: quote.valid_until || new Date().toISOString().split('T')[0],
        customer_id: String(quote.customer_id),
        currency: quote.currency || 'EUR',
        status: quote.status,
        items: (quote.quote_items || []).map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || 'stuks',
          price: Number(item.price) || 0,
        })),
        tax_percentage: quote.tax_percentage ?? 21,
        discount_percentage: quote.discount_percentage ?? 0,
        notes: quote.notes || '',
      });
    } catch (err) {
      console.error('Error loading quote:', err);
      setError('Fout bij het laden van offertegegevens');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
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

    if (formData.items.some(item => !item.description.trim())) {
      setError('Elke regel heeft een omschrijving nodig');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_number: formData.quote_number,
          quote_date: formData.quote_date,
          valid_until: formData.valid_until,
          customer_id: formData.customer_id,
          status: formData.status,
          currency: formData.currency,
          tax_percentage: formData.tax_percentage,
          discount_percentage: formData.discount_percentage,
          notes: formData.notes || null,
          items: formData.items,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/quotes');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    const confirmed = await confirm({
      title: 'Omzetten naar factuur',
      message: 'Deze offerte omzetten naar een factuur? Alle regels worden overgenomen.',
      confirmText: 'Omzetten',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    setIsConverting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/convert-to-invoice`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Er is iets misgegaan bij het omzetten');
        setIsConverting(false);
        return;
      }

      router.push(`/invoices/${data.id}`);
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsConverting(false);
    }
  };

  if (isLoadingData) {
    return (
      <Layout>
        <div className="loading">Laden...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="header">
        <h1>Offerte bewerken</h1>
        <div className="actions">
          {convertedInvoiceId ? (
            <Link href={`/invoices/${convertedInvoiceId}`} className="button cancel">
              Bekijk factuur
            </Link>
          ) : (
            <button type="button" className="button" onClick={handleConvertToInvoice} disabled={isConverting}>
              {isConverting ? 'Omzetten...' : 'Omzetten naar factuur'}
            </button>
          )}
          <button type="button" className="button cancel" onClick={() => router.push('/quotes')}>
            Annuleren
          </button>
          <button type="submit" form="quote-form" className="button" disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Bijwerken'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="block">
          <form id="quote-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="quote_number">Offertenummer</label>
                <input
                  id="quote_number"
                  type="text"
                  value={formData.quote_number}
                  onChange={(e) => setFormData({ ...formData, quote_number: e.target.value })}
                  placeholder="Offertenummer"
                  required
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="quote_date">Offertedatum</label>
                  <input
                    id="quote_date"
                    type="date"
                    value={formData.quote_date}
                    onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="valid_until">Geldig tot</label>
                  <input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <Select
                  value={statusOptions.find(o => o.value === formData.status) || null}
                  onChange={(option) => setFormData({ ...formData, status: option?.value || 'draft' })}
                  options={statusOptions}
                />
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
            title="Offerte"
            meta={[
              { label: 'Offertenummer', value: formData.quote_number },
              { label: 'Offertedatum', value: formatDate(formData.quote_date) },
              { label: 'Geldig tot', value: formatDate(formData.valid_until) },
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
