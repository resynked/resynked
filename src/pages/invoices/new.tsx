import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import DocumentEditor from '@/components/DocumentEditor';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { startBlocks, validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerOptionLabel } from '@/lib/utils';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

export default function NewInvoice() {
  const toast = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    blocks: startBlocks() as DocumentBlock[],
    intro_text: '',
    notes: '',
  });

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
    label: getCustomerOptionLabel(c),
  }));

  const handleSubmit = async () => {

    if (!formData.customer_id) {
      toast.error('Fout', 'Selecteer een klant');
      return;
    }

    const problem = validateBlocks(formData.blocks);
    if (problem) {
      toast.error('Fout', problem);
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
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/invoices');
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Nieuwe factuur">
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
        onBlocksChange={(blocks) => setFormData({ ...formData, blocks })}
        dataFields={
          <>
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

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="invoice_date">Factuurdatum</label>
                <DatePicker
                  value={formData.invoice_date}
                  onChange={(date) => setFormData({ ...formData, invoice_date: date })}
                  placeholder="Kies een datum..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="due_date">Vervaldatum</label>
                <DatePicker
                  value={formData.due_date}
                  onChange={(date) => setFormData({ ...formData, due_date: date })}
                  placeholder="Kies een datum..."
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
        }
      />

    </Layout>
  );
}
