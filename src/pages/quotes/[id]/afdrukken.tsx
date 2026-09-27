import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DocumentPreview, { SignatureState } from '@/components/DocumentPreview';
import { SkeletonCard } from '@/components/Skeleton';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

interface PrintQuote {
  quote_number: string;
  quote_date: string;
  valid_until: string;
  currency: string;
  blocks: DocumentBlock[];
  customer: Partial<Customer> | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_image: string | null;
}

/**
 * De offerte zonder menu of knoppen, klaar om af te drukken of op te slaan als
 * PDF. Het afdrukken laten we aan de browser over: die maakt een PDF met echte
 * tekst en houdt zich aan de @media print-regels uit het eigen sjabloon van de
 * aannemer — inclusief het papierformaat en de pagina-einden per blok.
 */
export default function PrintQuote() {
  const router = useRouter();
  const { id } = router.query;

  const [quote, setQuote] = useState<PrintQuote | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/quotes/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Offerte niet gevonden');
        return data;
      })
      .then(setQuote)
      .catch((err) => setFout(err.message));
  }, [id]);

  // Pas afdrukken als het document er echt staat: zonder de lettertypen valt
  // de opmaak anders uit dan op het scherm
  useEffect(() => {
    if (!quote) return;

    let gestopt = false;
    const afdrukken = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // Kent de browser dit niet, dan drukken we gewoon af
      }
      if (!gestopt) window.print();
    };

    const wachten = setTimeout(afdrukken, 300);
    return () => {
      gestopt = true;
      clearTimeout(wachten);
    };
  }, [quote]);

  const signature: SignatureState | null = quote
    ? { image: quote.signature_image, name: quote.signed_name, signedAt: quote.signed_at }
    : null;

  return (
    <>
      <Head>
        {/* De browser stelt deze naam voor als bestandsnaam van de PDF */}
        <title>{quote ? `Offerte ${quote.quote_number}` : 'Offerte'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="print-page">
        {!quote && !fout && <SkeletonCard />}

        {fout && (
          <div className="empty-state">
            <h2>Offerte niet gevonden</h2>
            <p>{fout}</p>
          </div>
        )}

        {quote && (
          <>
            <div className="print-actions">
              <button type="button" className="button" onClick={() => window.print()}>
                Opslaan als PDF
              </button>
            </div>

            <DocumentPreview
              title="Offerte"
              meta={[
                { label: 'Offertenummer', value: quote.quote_number },
                { label: 'Offertedatum', value: formatDate(quote.quote_date) },
                { label: 'Geldig tot', value: formatDate(quote.valid_until) },
              ]}
              customer={quote.customer}
              blocks={quote.blocks}
              currency={quote.currency}
              signature={signature}
            />
          </>
        )}
      </div>
    </>
  );
}
