import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CircleCheck } from 'lucide-react';
import DocumentPreview from '@/components/DocumentPreview';
import { SkeletonCard } from '@/components/Skeleton';
import type { Customer, DocumentBlock, Tenant } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { invoiceReference } from '@/lib/payment';
import { pageTitle } from '@/lib/constants';

interface PublicInvoice {
  id: number;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: string;
  currency: string;
  paid_at: string | null;
  blocks: DocumentBlock[];
  customer: Partial<Customer> | null;
}

/**
 * De pagina waar de klant terechtkomt via de knop in de factuurmail. Geen
 * inlog, geen menu: de factuur met het betaalblok en de QR-code, en onderin
 * een balk met de betaalknop als de aannemer Mollie heeft gekoppeld.
 */
export default function PublicInvoice() {
  const router = useRouter();
  const { token } = router.query;

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [canPayOnline, setCanPayOnline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/public/invoices/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Er is iets misgegaan');
        return data;
      })
      .then((data) => {
        setInvoice(data.invoice);
        setTenant(data.tenant);
        setCanPayOnline(data.canPayOnline);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const payOnline = async () => {
    setIsPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/public/invoices/${token}/pay`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'Betalen lukt nu niet');
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setPayError(err.message);
      setIsPaying(false);
    }
  };

  const isPaid = invoice?.status === 'paid';
  // Terug van Mollie: de bevestiging komt los, dus even geduld
  const justPaid = !isPaid && router.query.paid === '1';

  return (
    <>
      <Head>
        <title>{pageTitle(invoice ? `Factuur ${invoice.invoice_number || ''}`.trim() : 'Factuur')}</title>
        {/* Deze pagina hoort nergens in een zoekmachine te staan */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="public-document">
        {isLoading && (
          <div className="block">
            <SkeletonCard />
          </div>
        )}

        {!isLoading && loadError && (
          <div className="block empty-state">
            <h2>Factuur niet gevonden</h2>
            <p>{loadError}</p>
          </div>
        )}

        {!isLoading && invoice && (
          <>
            <div className="block">
              <DocumentPreview
                title="Factuur"
                meta={[
                  { label: 'Factuurnummer', value: invoice.invoice_number || '' },
                  { label: 'Factuurdatum', value: formatDate(invoice.invoice_date) },
                  { label: 'Vervaldatum', value: formatDate(invoice.due_date) },
                ]}
                customer={invoice.customer}
                blocks={invoice.blocks}
                currency={invoice.currency}
                tenant={tenant}
                // Betaald: dan geen QR-code meer, anders betaalt iemand twee keer
                payment={isPaid ? null : { reference: invoiceReference(invoice), dueDate: invoice.due_date }}
              />
            </div>

            {/* Onderin, altijd in beeld: betalen, of de bevestiging daarvan */}
            <div className="island-bar rich-editor">
              <div className="toolbar">
                {isPaid ? (
                  <div className="group selection-count">
                    <CircleCheck size={15} />
                    <span>Betaald{invoice.paid_at ? ` op ${formatDate(invoice.paid_at)}` : ''}. Bedankt!</span>
                  </div>
                ) : justPaid ? (
                  <div className="group selection-count">
                    <span>Bedankt! Zodra de betaling binnen is, staat de factuur hier op betaald.</span>
                  </div>
                ) : (
                  <>
                    <div className="group selection-count">
                      <span>
                        {payError || `Te betalen: ${formatCurrency(invoice.total, invoice.currency)}`}
                      </span>
                    </div>
                    {canPayOnline && (
                      <div className="group">
                        <button type="button" className="button" onClick={payOnline} disabled={isPaying}>
                          {isPaying ? 'Even geduld...' : 'Nu betalen'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
