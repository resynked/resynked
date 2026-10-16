import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Undo2, Redo2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { useHistory } from '@/hooks/useHistory';
import { useToast } from '@/components/Toast';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import DocumentEditor from '@/components/DocumentEditor';
import { useMailAccount } from '@/hooks/useMailAccount';
import { useConfirm } from '@/hooks/useConfirm';
import { invoiceReference } from '@/lib/payment';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { copyBlocks, validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerOptionLabel, vandaag, overDagen } from '@/lib/utils';
import { SkeletonCard } from '@/components/Skeleton';

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
  const toast = useToast();
  const router = useRouter();
  const { id } = router.query;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [sourceQuoteId, setSourceQuoteId] = useState<number | null>(null);
  const { confirm } = useConfirm();
  // Versturen gaat via de eigen Gmail of Outlook; zonder koppeling is er geen knop
  const mailAccount = useMailAccount();
  const [isSending, setIsSending] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: vandaag(),
    due_date: overDagen(30),
    customer_id: '',
    currency: 'EUR',
    status: 'draft',
    blocks: [] as DocumentBlock[],
    intro_text: '',
    notes: '',
  });

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
        toast.error('Fout', 'Factuur niet gevonden');
        return;
      }

      const invoice: any = await response.json();

      setSourceQuoteId(invoice.quote_id || null);
      setPaidAt(invoice.paid_at || null);
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date || vandaag(),
        due_date: invoice.due_date || vandaag(),
        customer_id: String(invoice.customer_id),
        currency: invoice.currency || 'EUR',
        status: invoice.status,
        blocks: copyBlocks(invoice.blocks),
        intro_text: invoice.intro_text || '',
        notes: invoice.notes || '',
      });
    } catch (err) {
      console.error('Error loading invoice:', err);
      toast.error('Fout', 'Fout bij het laden van factuurgegevens');
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
    label: getCustomerOptionLabel(c),
  }));

  // Cmd+Z en Cmd+Shift+Z draaien de laatste stappen terug
  const geschiedenis = useHistory(formData, setFormData, { enabled: !isLoadingData });

  /** Legt vast wat er op het scherm staat. Geeft false als dat niet lukte */
  const save = async (): Promise<boolean> => {
    const problem = validateBlocks(formData.blocks);
    if (problem) {
      toast.error('Fout', problem);
      return false;
    }

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
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        return false;
      }
      return true;
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      return false;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    if (await save()) router.push('/invoices');
    else setIsLoading(false);
  };

  /** De PDF, van wat er nu op het scherm staat */
  const handleDownload = async () => {
    if (await save()) window.location.href = `/api/invoices/${id}/pdf`;
  };

  const handleSend = async () => {
    const confirmed = await confirm({
      title: 'Factuur versturen',
      message:
        'De klant krijgt een mail met de betaalgegevens en QR-code, en een knop naar deze factuur om hem te bekijken en te betalen.',
      confirmText: 'Versturen',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    setIsSending(true);
    try {
      // Eerst vastleggen, anders krijgt de klant een oudere versie te zien
      if (!(await save())) return;

      const response = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        toast.error('Versturen mislukt', data.error || 'Er is iets misgegaan');
        return;
      }

      toast.success('Verstuurd', `De factuur is naar ${data.to} gestuurd`);
      setFormData((current) => ({ ...current, status: current.status === 'draft' ? 'sent' : current.status }));
    } catch {
      toast.error('Versturen mislukt', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsSending(false);
    }
  };

  /** Betaald buiten Khance om, zoals met de QR-code: legt meteen de betaaldatum vast */
  const handleMarkPaid = async (paid: boolean) => {
    setIsMarking(true);
    try {
      if (!(await save())) return;

      const response = await fetch(`/api/invoices/${id}/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        return;
      }

      setFormData((current) => ({ ...current, status: data.status }));
      setPaidAt(data.paid_at || null);
      toast.success('Gelukt', paid ? 'De factuur staat op betaald' : 'De factuur staat weer open');
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsMarking(false);
    }
  };

  if (isLoadingData) {
    return (
      <Layout title="Factuur bewerken">
        <div className="header">
          <h1>Factuur bewerken</h1>
        </div>
        <SkeletonCard />
      </Layout>
    );
  }

  return (
    <Layout title="Factuur bewerken">
      <div className="header">
        <h1>Factuur bewerken</h1>
        <div className="actions">
          <button
            type="button"
            className="button icon"
            title="Ongedaan maken (Cmd+Z)"
            aria-label="Ongedaan maken"
            onClick={geschiedenis.terug}
            disabled={!geschiedenis.kanTerug}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="button icon"
            title="Opnieuw (Cmd+Shift+Z)"
            aria-label="Opnieuw"
            onClick={geschiedenis.opnieuw}
            disabled={!geschiedenis.kanOpnieuw}
          >
            <Redo2 size={16} />
          </button>
          {formData.status === 'paid' && paidAt && (
            <span className="autosave-status saved">Betaald op {formatDate(paidAt)}</span>
          )}
          {sourceQuoteId && (
            <Link href={`/quotes/${sourceQuoteId}`} className="button cancel">
              Bekijk offerte
            </Link>
          )}
          {mailAccount && (
            <button type="button" className="button cancel" onClick={handleSend} disabled={isSending}>
              {isSending ? 'Versturen...' : 'Versturen'}
            </button>
          )}
          <button type="button" className="button cancel" onClick={handleDownload}>
            Downloaden
          </button>
          {formData.status === 'paid' ? (
            <button type="button" className="button cancel" onClick={() => handleMarkPaid(false)} disabled={isMarking}>
              Toch niet betaald
            </button>
          ) : (
            formData.status !== 'cancelled' && (
              <button type="button" className="button cancel" onClick={() => handleMarkPaid(true)} disabled={isMarking}>
                {isMarking ? 'Bezig...' : 'Markeer als betaald'}
              </button>
            )
          )}
          <button type="button" className="button cancel" onClick={() => router.push('/invoices')}>
            Annuleren
          </button>
          <button type="button" className="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Bijwerken'}
          </button>
        </div>
      </div>

      <DocumentEditor
        title="Factuur"
        meta={[
          { label: 'Factuurnummer', value: formData.invoice_number },
          { label: 'Factuurdatum', value: formatDate(formData.invoice_date) },
          { label: 'Vervaldatum', value: formatDate(formData.due_date) },
        ]}
        customer={selectedCustomer}
        blocks={formData.blocks}
        currency={formData.currency}
        // Het betaalblok met de QR-code, zoals de klant hem ook ziet; niet meer na betaling
        payment={
          formData.status === 'paid'
            ? null
            : { reference: invoiceReference({ id: String(id), invoice_number: formData.invoice_number }), dueDate: formData.due_date }
        }
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
                  placeholder="Selecteer een klant"
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="invoice_number">Factuurnummer</label>
                <input
                  id="invoice_number"
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Vul een factuurnummer in"
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="invoice_date">Factuurdatum</label>
                <DatePicker
                  value={formData.invoice_date}
                  onChange={(date) => setFormData({ ...formData, invoice_date: date })}
                  placeholder="Selecteer een datum"
                />
              </div>

              <div className="form-group">
                <label htmlFor="due_date">Vervaldatum</label>
                <DatePicker
                  value={formData.due_date}
                  onChange={(date) => setFormData({ ...formData, due_date: date })}
                  placeholder="Selecteer een datum"
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
