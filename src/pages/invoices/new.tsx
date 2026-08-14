import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import DocumentBlocks from '@/components/DocumentBlocks';
import DocumentEditor from '@/components/DocumentEditor';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { emptyBlock, validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

export default function NewInvoice() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    blocks: [emptyBlock()] as DocumentBlock[],
    intro_text: '',
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

  const handleSubmit = async () => {
    setError('');

    if (!formData.customer_id) {
      setError('Selecteer een klant');
      return;
    }

    const problem = validateBlocks(formData.blocks);
    if (problem) {
      setError(problem);
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
          intro_text: formData.intro_text || null,
          notes: formData.notes || null,
          status: 'draft',
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

  return (
    <Layout>
      <div className="header">
        <h1>Nieuwe factuur aanmaken</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/invoices')}>
            Annuleren
          </button>
          <button type="button" className="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <DocumentEditor
        title="Factuur"
        meta={[
          { label: 'Factuurnummer', value: 'Wordt automatisch toegekend' },
          { label: 'Factuurdatum', value: formatDate(formData.invoice_date) },
          { label: 'Vervaldatum', value: formatDate(formData.due_date) },
        ]}
        customer={selectedCustomer}
        blocks={formData.blocks}
        currency={formData.currency}
        introText={formData.intro_text}
        notes={formData.notes}
        panels={{
          customer: {
            title: 'Klant',
            content: (
              <div className="form-section">
                <div className="form-group">
                  <label>Klant</label>
                  <Select
                    value={customerOptions.find(o => o.value === formData.customer_id) || null}
                    onChange={(option) => setFormData({ ...formData, customer_id: option?.value || '' })}
                    options={customerOptions}
                    placeholder="Selecteer klant..."
                  />
                </div>
              </div>
            ),
          },
          details: {
            title: 'Factuurgegevens',
            content: (
              <>
                <div className="form-section">
                  <div className="form-group">
                    <label htmlFor="invoice_date">Factuurdatum</label>
                    <input
                      id="invoice_date"
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="due_date">Vervaldatum</label>
                    <input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-group">
                    <label>Valuta</label>
                    <Select
                      value={currencyOptions.find(o => o.value === formData.currency) || null}
                      onChange={(option) => setFormData({ ...formData, currency: option?.value || 'EUR' })}
                      options={currencyOptions}
                    />
                  </div>
                </div>
              </>
            ),
          },
          intro: {
            title: 'Begeleidende tekst',
            content: (
              <div className="form-section">
                <div className="form-group">
                  <textarea
                    value={formData.intro_text}
                    onChange={(e) => setFormData({ ...formData, intro_text: e.target.value })}
                    placeholder="Eventuele begeleidende tekst..."
                    rows={12}
                  />
                </div>
              </div>
            ),
          },
          blocks: {
            title: 'Blokken',
            content: (
              <DocumentBlocks
                blocks={formData.blocks}
                onChange={(blocks) => setFormData({ ...formData, blocks })}
              />
            ),
          },
          notes: {
            title: 'Opmerkingen',
            content: (
              <div className="form-section">
                <div className="form-group">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Eventuele opmerkingen..."
                    rows={8}
                  />
                </div>
              </div>
            ),
          },
        }}
      />

    </Layout>
  );
}
