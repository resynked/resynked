import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import DocumentBlocks from '@/components/DocumentBlocks';
import DocumentPreview from '@/components/DocumentPreview';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const statusOptions = [
  { value: 'draft', label: 'Concept' },
  { value: 'sent', label: 'Verzonden' },
  { value: 'paid', label: 'Betaald' },
  { value: 'cancelled', label: 'Geannuleerd' },
];

export default function EditInvoice() {
  const router = useRouter();
  const { id } = router.query;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [sourceQuoteId, setSourceQuoteId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    status: 'draft',
    blocks: [] as DocumentBlock[],
    intro_text: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchInvoice();
    fetchCustomers();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) {
        setError('Factuur niet gevonden');
        return;
      }

      const invoice: any = await response.json();

      setSourceQuoteId(invoice.quote_id || null);
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date || new Date().toISOString().split('T')[0],
        customer_id: String(invoice.customer_id),
        currency: invoice.currency || 'EUR',
        status: invoice.status,
        blocks: (invoice.blocks || []).map((block: any) => ({
          title: block.title || '',
          kind: block.kind || 'prijsopgave',
          body: block.body || '',
          tax_percentage: Number(block.tax_percentage) || 0,
          discount_percentage: Number(block.discount_percentage) || 0,
          items: (block.items || []).map((item: any) => ({
            description: item.description || '',
            is_heading: !!item.is_heading,
            quantity: Number(item.quantity) || 0,
            unit: item.unit || null,
            price: Number(item.price) || 0,
          })),
        })),
        intro_text: invoice.intro_text || '',
        notes: invoice.notes || '',
      });
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError('Fout bij het laden van factuurgegevens');
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

    const problem = validateBlocks(formData.blocks);
    if (problem) {
      setError(problem);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          customer_id: formData.customer_id,
          status: formData.status,
          currency: formData.currency,
          intro_text: formData.intro_text || null,
          notes: formData.notes || null,
          blocks: formData.blocks,
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
        <h1>Factuur bewerken</h1>
        <div className="actions">
          {sourceQuoteId && (
            <Link href={`/quotes/${sourceQuoteId}`} className="button cancel">
              Bekijk offerte
            </Link>
          )}
          <button type="button" className="button cancel" onClick={() => router.push('/invoices')}>
            Annuleren
          </button>
          <button type="submit" form="invoice-form" className="button" disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Bijwerken'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="block">
          <form id="invoice-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="invoice_number">Factuurnummer</label>
                <input
                  id="invoice_number"
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Factuurnummer"
                />
              </div>
            </div>

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
              <div className="form-group">
                <label htmlFor="intro_text">Begeleidende tekst</label>
                <textarea
                  id="intro_text"
                  value={formData.intro_text}
                  onChange={(e) => setFormData({ ...formData, intro_text: e.target.value })}
                  placeholder="Eventuele begeleidende tekst..."
                  rows={6}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Blokken</h3>

              <div className="form-group">
                <label>Valuta</label>
                <Select
                  value={currencyOptions.find(o => o.value === formData.currency) || null}
                  onChange={(option) => setFormData({ ...formData, currency: option?.value || 'EUR' })}
                  options={currencyOptions}
                />
              </div>
            </div>

            <DocumentBlocks
              blocks={formData.blocks}
              onChange={(blocks) => setFormData({ ...formData, blocks })}
            />

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
              { label: 'Factuurnummer', value: formData.invoice_number },
              { label: 'Factuurdatum', value: formatDate(formData.invoice_date) },
              { label: 'Vervaldatum', value: formatDate(formData.due_date) },
            ]}
            customer={selectedCustomer}
            blocks={formData.blocks}
            currency={formData.currency}
            introText={formData.intro_text}
            notes={formData.notes}
          />
        </div>
      </div>
    </Layout>
  );
}
