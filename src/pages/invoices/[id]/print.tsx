import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DocumentPreview from '@/components/DocumentPreview';
import { SkeletonCard } from '@/components/Skeleton';
import type { Customer, DocumentBlock, Tenant } from '@/lib/supabase';
import { invoiceMeta, invoiceTitle, isCreditNote } from '@/lib/invoices';
import { invoiceReference } from '@/lib/payment';
import { usePrintWhenReady } from '@/hooks/usePrintWhenReady';

interface PrintInvoice {
  id: number;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  blocks: DocumentBlock[];
  customer: Partial<Customer> | null;
  credit_for_invoice_id: number | null;
  /** Bij een creditfactuur: de factuur die hij corrigeert */
  credit_for: { invoice_number: string | null } | null;
}

/**
 * De factuur zonder menu of knoppen, klaar om af te drukken of als PDF op te
 * slaan; met het betaalblok en de QR-code. Zelfde opzet als bij offertes.
 */
export default function PrintInvoice() {
  const router = useRouter();
  const { id } = router.query;

  const [invoice, setInvoice] = useState<PrintInvoice | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/invoices/${id}`).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Factuur niet gevonden');
        return data;
      }),
      fetch('/api/tenant').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([factuur, bedrijf]) => {
        setTenant(bedrijf);
        setInvoice(factuur);
      })
      .catch((err) => setFout(err.message));
  }, [id]);

  // Afdrukken zodra het document er echt staat; niet als de server hem ophaalt voor de PDF
  usePrintWhenReady(!!invoice && !router.query.pdf);

  return (
    <>
      <Head>
        {/* De browser stelt deze naam voor als bestandsnaam van de PDF */}
        <title>{invoice ? `${invoiceTitle(invoice)} ${invoice.invoice_number || invoice.id}` : 'Factuur'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="print-page">
        {!invoice && !fout && <SkeletonCard />}

        {fout && (
          <div className="empty-state">
            <h2>Factuur niet gevonden</h2>
            <p>{fout}</p>
          </div>
        )}

        {invoice && (
          <>
            <div className="print-actions">
              <button type="button" className="button" onClick={() => window.print()}>
                Opslaan als PDF
              </button>
            </div>

            <DocumentPreview
              title={invoiceTitle(invoice)}
              meta={invoiceMeta(invoice, invoice.credit_for)}
              customer={invoice.customer}
              blocks={invoice.blocks}
              currency={invoice.currency}
              tenant={tenant}
              payment={isCreditNote(invoice) ? null : { reference: invoiceReference(invoice), dueDate: invoice.due_date }}
              papier="vol"
            />
          </>
        )}
      </div>
    </>
  );
}
