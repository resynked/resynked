import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DocumentPreview, { SignatureState } from '@/components/DocumentPreview';
import { SkeletonCard } from '@/components/Skeleton';
import type { Customer, DocumentBlock, Tenant } from '@/lib/supabase';
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
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // De bedrijfsgegevens worden hier opgehaald en meegegeven, zodat het
  // document niet pas begint te laden als het al op het scherm staat
  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/quotes/${id}`).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Offerte niet gevonden');
        return data;
      }),
      fetch('/api/tenant').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([offerte, bedrijf]) => {
        setTenant(bedrijf);
        setQuote(offerte);
      })
      .catch((err) => setFout(err.message));
  }, [id]);

  /**
   * Pas afdrukken als het document er echt staat.
   *
   * Het sjabloon wordt in stappen opgebouwd: eerst opschonen, dan in de DOM
   * zetten, en daarna pas gaat de inhoud in de plekken met data-slot. Een vaste
   * wachttijd is daarvoor te wankel — dan krijg je een lege of halve pagina op
   * papier. Daarom wordt er gekeken of de inhoud er werkelijk is, en of de
   * afbeeldingen en lettertypen binnen zijn.
   */
  useEffect(() => {
    if (!quote) return;

    // Haalt de server deze pagina op om er een PDF van te maken, dan hoeft
    // het printvenster niet open: die doet het werk zelf
    if (router.query.pdf) return;

    let gestopt = false;

    const isKlaar = () => {
      const vel = document.querySelector('.print-page');
      if (!vel) return false;

      // De blokken van de offerte staan er pas als hun elementen er staan
      if (!vel.querySelector('[data-element]')) return false;

      // Een logo dat nog laadt zou als leeg vlak op papier komen
      const afbeeldingen = Array.from(vel.querySelectorAll('img'));
      return afbeeldingen.every((img) => img.complete);
    };

    const afdrukken = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // Kent de browser dit niet, dan drukken we zonder die zekerheid af
      }
      if (!gestopt) window.print();
    };

    // Elke tiende seconde kijken, en na acht seconden hoe dan ook afdrukken
    const begin = Date.now();
    const klok = setInterval(() => {
      if (gestopt) return;
      if (isKlaar() || Date.now() - begin > 8000) {
        clearInterval(klok);
        afdrukken();
      }
    }, 100);

    return () => {
      gestopt = true;
      clearInterval(klok);
    };
  }, [quote, router.query.pdf]);

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
              tenant={tenant}
              signature={signature}
              papier="vol"
            />
          </>
        )}
      </div>
    </>
  );
}
