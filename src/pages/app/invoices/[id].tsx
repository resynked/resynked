import HelpButton from '@/components/HelpButton';
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
import { invoiceMeta, invoiceTitle, isFinalInvoice } from '@/lib/invoices';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { copyBlocks, validateBlocks } from '@/lib/blocks';
import { formatDate, getCustomerOptionLabel, vandaag, overDagen } from '@/lib/utils';
import { SkeletonCard } from '@/components/Skeleton';

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

/** Wat er bij een vastliggende factuur naast de knoppen staat */
const STATUS_TEXT: Record<string, string> = {
  sent: 'Verzonden',
  paid: 'Betaald',
  cancelled: 'Geannuleerd',
};

/** Een factuur of creditfactuur die bij deze hoort, om naartoe te klikken */
interface LinkedInvoice {
  id: number;
  invoice_number: string | null;
}

/** Na deze stap ligt de factuur vast; dat staat in elke bevestiging */
const FINAL_NOTE = 'Hij krijgt dan zijn nummer en is daarna niet meer te wijzigen; corrigeren gaat met een creditfactuur.';

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
  const [isCrediting, setIsCrediting] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ count: number; sentAt: string } | null>(null);
  const [creditFor, setCreditFor] = useState<LinkedInvoice | null>(null);
  const [creditNotes, setCreditNotes] = useState<LinkedInvoice[]>([]);

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

  // Een verstuurde factuur is alleen nog te bekijken, downloaden en crediteren
  const isFinal = isFinalInvoice(formData);
  const title = invoiceTitle({ credit_for_invoice_id: creditFor?.id });

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
      setSentAt(invoice.sent_at || null);
      setReminder(invoice.reminder_count && invoice.reminder_sent_at ? { count: invoice.reminder_count, sentAt: invoice.reminder_sent_at } : null);
      setCreditFor(invoice.credit_for || null);
      setCreditNotes(invoice.credit_notes || []);
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

  // Cmd+Z en Cmd+Shift+Z draaien de laatste stappen terug, zolang het een concept is
  const geschiedenis = useHistory(formData, setFormData, { enabled: !isLoadingData && !isFinal });

  /**
   * Legt vast wat er op het scherm staat. Geeft false als dat niet lukte. Een
   * vastliggende factuur verandert niet meer, dus daar valt niets op te slaan.
   */
  const save = async (status = formData.status): Promise<boolean> => {
    if (isFinal) return true;

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
          invoice_date: formData.invoice_date,
          due_date: creditFor ? null : formData.due_date,
          customer_id: formData.customer_id,
          status,
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
    if (await save()) router.push('/app/invoices');
    else setIsLoading(false);
  };

  /** De PDF, van wat er nu op het scherm staat */
  const handleDownload = async () => {
    if (await save()) window.location.href = `/api/invoices/${id}/pdf`;
  };

  const handleSend = async () => {
    const confirmed = await confirm({
      title: `${title} versturen`,
      message: isFinal
        ? `De klant krijgt de ${title.toLowerCase()} nog een keer per mail.`
        : creditFor
          ? `De klant krijgt een mail met een knop naar deze creditfactuur. ${FINAL_NOTE}`
          : `De klant krijgt een mail met de betaalgegevens en QR-code, en een knop naar deze factuur om hem te bekijken en te betalen. ${FINAL_NOTE}`,
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

      toast.success('Verstuurd', `De ${title.toLowerCase()} is naar ${data.to} gestuurd`);
      // Opnieuw ophalen: bij het versturen heeft hij zijn nummer gekregen
      fetchInvoice();
    } catch {
      toast.error('Versturen mislukt', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsSending(false);
    }
  };

  /** Zelf verstuurd, bijvoorbeeld de PDF in een eigen mail: dan ligt hij ook vast */
  const handleMarkSent = async () => {
    const confirmed = await confirm({
      title: 'Markeren als verzonden',
      message: `Verstuur je de ${title.toLowerCase()} zelf? Download hem dan na deze stap, dan staat het nummer erop. ${FINAL_NOTE}`,
      confirmText: 'Markeren als verzonden',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    setIsMarking(true);
    if (await save('sent')) {
      fetchInvoice();
      toast.success('Gelukt', `De ${title.toLowerCase()} staat op verzonden`);
    }
    setIsMarking(false);
  };

  /** Betaald buiten Synbased om, zoals met de QR-code: legt meteen de betaaldatum vast */
  const handleMarkPaid = async (paid: boolean) => {
    if (paid && !isFinal) {
      const confirmed = await confirm({
        title: 'Markeren als betaald',
        message: `Is deze ${title.toLowerCase()} al betaald? ${FINAL_NOTE}`,
        confirmText: 'Markeren als betaald',
        cancelText: 'Annuleren',
      });
      if (!confirmed) return;
    }

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

      fetchInvoice();
      toast.success('Gelukt', paid ? `De ${title.toLowerCase()} staat op betaald` : `De ${title.toLowerCase()} staat weer open`);
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsMarking(false);
    }
  };

  /** Een creditfactuur met alle regels in min, als concept om eventueel in te korten */
  const handleCredit = async () => {
    const confirmed = await confirm({
      title: 'Creditfactuur maken',
      message:
        'Er komt een creditfactuur met alle regels van deze factuur in min. Gaat het maar om een deel? Haal dan in het concept de regels weg die blijven staan.',
      confirmText: 'Creditfactuur maken',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    setIsCrediting(true);
    try {
      const response = await fetch(`/api/invoices/${id}/credit`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsCrediting(false);
        return;
      }
      router.push(`/app/invoices/${data.id}`);
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsCrediting(false);
    }
  };

  const heading = isFinal ? `${title} ${formData.invoice_number}`.trim() : `${title} bewerken`;

  if (isLoadingData) {
    return (
      <Layout title="Factuur bewerken">
        <div className="header">
          <h1>Factuur bewerken <HelpButton topic="invoices" /></h1>
        </div>
        <SkeletonCard />
      </Layout>
    );
  }

  return (
    <Layout title={heading}>
      <div className="header">
        <h1>{heading} <HelpButton topic="invoices" /></h1>
        <div className="actions">
          {!isFinal && (
            <>
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
            </>
          )}
          {isFinal && (
            <span className="autosave-status saved">
              {formData.status === 'paid' && paidAt
                ? `Betaald op ${formatDate(paidAt)}`
                : formData.status === 'sent' && sentAt
                  ? `Verzonden op ${formatDate(sentAt)}${
                      // De laatste betalingsherinnering, zie Instellingen > Facturen
                      reminder ? ` · ${reminder.count > 1 ? 'tweede herinnering' : 'herinnering'} op ${formatDate(reminder.sentAt)}` : ''
                    }`
                  : STATUS_TEXT[formData.status] || formData.status}
            </span>
          )}
          {sourceQuoteId && (
            <Link href={`/app/quotes/${sourceQuoteId}`} className="button cancel">
              Bekijk offerte
            </Link>
          )}
          {creditFor && (
            <Link href={`/app/invoices/${creditFor.id}`} className="button cancel">
              Bekijk factuur {creditFor.invoice_number}
            </Link>
          )}
          {creditNotes.map((note) => (
            <Link key={note.id} href={`/app/invoices/${note.id}`} className="button cancel">
              Bekijk creditfactuur {note.invoice_number || '(concept)'}
            </Link>
          ))}
          {mailAccount && (
            <button type="button" className="button cancel" onClick={handleSend} disabled={isSending}>
              {isSending ? 'Versturen...' : isFinal ? 'Opnieuw versturen' : 'Versturen'}
            </button>
          )}
          {!isFinal && (
            <button type="button" className="button cancel" onClick={handleMarkSent} disabled={isMarking}>
              Markeren als verzonden
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
          {isFinal ? (
            <>
              {!creditFor && (
                <button type="button" className="button cancel" onClick={handleCredit} disabled={isCrediting}>
                  {isCrediting ? 'Bezig...' : 'Creditfactuur maken'}
                </button>
              )}
              <button type="button" className="button" onClick={() => router.push('/app/invoices')}>
                Terug
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button cancel" onClick={() => router.push('/app/invoices')}>
                Annuleren
              </button>
              <button type="button" className="button" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Bijwerken...' : 'Bijwerken'}
              </button>
            </>
          )}
        </div>
      </div>

      <DocumentEditor
        title={title}
        meta={invoiceMeta(formData, creditFor)}
        customer={selectedCustomer}
        blocks={formData.blocks}
        currency={formData.currency}
        // Het betaalblok met de QR-code, zoals de klant hem ook ziet; niet meer na betaling
        payment={
          formData.status === 'paid' || creditFor
            ? null
            : { reference: invoiceReference({ id: String(id), invoice_number: formData.invoice_number }), dueDate: formData.due_date }
        }
        // Zonder onBlocksChange is het document alleen te bekijken
        onBlocksChange={isFinal ? undefined : (blocks) => setFormData({ ...formData, blocks })}
        dataFields={
          isFinal ? undefined : (
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
                  <label htmlFor="invoice_date">Factuurdatum</label>
                  <DatePicker
                    value={formData.invoice_date}
                    onChange={(date) => setFormData({ ...formData, invoice_date: date })}
                    placeholder="Selecteer een datum"
                  />
                </div>

                {!creditFor && (
                  <div className="form-group">
                    <label htmlFor="due_date">Vervaldatum</label>
                    <DatePicker
                      value={formData.due_date}
                      onChange={(date) => setFormData({ ...formData, due_date: date })}
                      placeholder="Selecteer een datum"
                    />
                  </div>
                )}
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
          )
        }
      />

    </Layout>
  );
}
