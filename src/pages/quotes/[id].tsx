import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import DocumentEditor from '@/components/DocumentEditor';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';
import { useConfirm } from '@/hooks/useConfirm';
import { SkeletonCard } from '@/components/Skeleton';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const statusOptions = [
  { value: 'draft', label: 'Concept' },
  { value: 'sent', label: 'Verzonden' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'rejected', label: 'Afgewezen' },
  { value: 'expired', label: 'Verlopen' },
];

export default function EditQuote() {
  const toast = useToast();
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
    blocks: [] as DocumentBlock[],
    intro_text: '',
    notes: '',
  });

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
        toast.error('Fout', 'Offerte niet gevonden');
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
        blocks: (quote.blocks || []).map((block: any) => ({
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
        intro_text: quote.intro_text || '',
        notes: quote.notes || '',
      });
    } catch (err) {
      console.error('Error loading quote:', err);
      toast.error('Fout', 'Fout bij het laden van offertegegevens');
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

  const handleSubmit = async () => {

    const problem = validateBlocks(formData.blocks);
    if (problem) {
      toast.error('Fout', problem);
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

  const handleConvertToInvoice = async () => {
    const confirmed = await confirm({
      title: 'Omzetten naar factuur',
      message: 'Deze offerte omzetten naar een factuur? Alle blokken en regels worden overgenomen.',
      confirmText: 'Omzetten',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    setIsConverting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/convert-to-invoice`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan bij het omzetten');
        setIsConverting(false);
        return;
      }

      router.push(`/invoices/${data.id}`);
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsConverting(false);
    }
  };

  if (isLoadingData) {
    return (
      <Layout>
        <div className="header">
          <h1>Offerte bewerken</h1>
        </div>
        <SkeletonCard />
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
          <button type="button" className="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Bijwerken'}
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
                <label>Status</label>
                <Select
                  value={statusOptions.find(o => o.value === formData.status) || null}
                  onChange={(option) => setFormData({ ...formData, status: option?.value || 'draft' })}
                  options={statusOptions}
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
