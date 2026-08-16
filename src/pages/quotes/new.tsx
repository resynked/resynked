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

export default function NewQuote() {
  const toast = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [formData, setFormData] = useState({
    quote_number: '',
    quote_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    blocks: startBlocks() as DocumentBlock[],
    intro_text: '',
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Wachten tot het adres uitgelezen is, anders mist de klant uit de link
    if (!router.isReady) return;
    fetchCustomers();
    fetchNextNumber();
  }, [router.isReady]);

  // Het nummer dat de aannemer bij Instellingen heeft ingesteld staat alvast in
  // het veld, zodat hij ziet wat hij krijgt en het desgewenst kan aanpassen
  const fetchNextNumber = async () => {
    try {
      const res = await fetch('/api/tenant');
      if (!res.ok) return;

      const tenant = await res.json();
      if (tenant?.quote_number_next) {
        setFormData(prev => ({ ...prev, quote_number: tenant.quote_number_next }));
      }
    } catch (err) {
      console.error('Error fetching next quote number:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);

      // Kom je hier vanuit een klant, dan staat die al goed; anders de eerste
      const vanaf = router.query.customer_id;
      const gekozen = typeof vanaf === 'string' && data.some((c: Customer) => String(c.id) === vanaf)
        ? vanaf
        : data.length > 0 ? String(data[0].id) : '';

      if (gekozen) setFormData(prev => ({ ...prev, customer_id: gekozen }));
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
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_number: formData.quote_number,
          quote_date: formData.quote_date,
          valid_until: formData.valid_until,
          customer_id: formData.customer_id,
          currency: formData.currency,
          intro_text: formData.intro_text || null,
          notes: formData.notes || null,
          blocks: formData.blocks,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/quotes');
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Nieuwe offerte">
      <div className="header">
        <h1>Nieuwe offerte aanmaken</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/quotes')}>
            Annuleren
          </button>
          <button type="button" className="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      <DocumentEditor
        title="Offerte"
        meta={[
          { label: 'Offertenummer', value: formData.quote_number },
          { label: 'Offertedatum', value: formatDate(formData.quote_date) },
          { label: 'Geldig tot', value: formatDate(formData.valid_until) },
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
                <label htmlFor="quote_number">Offertenummer</label>
                <input
                  id="quote_number"
                  type="text"
                  value={formData.quote_number}
                  onChange={(e) => setFormData({ ...formData, quote_number: e.target.value })}
                  placeholder="Offertenummer"
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="quote_date">Offertedatum</label>
                <DatePicker
                  value={formData.quote_date}
                  onChange={(date) => setFormData({ ...formData, quote_date: date })}
                  placeholder="Kies een datum..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="valid_until">Geldig tot</label>
                <DatePicker
                  value={formData.valid_until}
                  onChange={(date) => setFormData({ ...formData, valid_until: date })}
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
