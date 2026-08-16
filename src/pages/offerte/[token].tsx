import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CircleCheck } from 'lucide-react';
import DocumentPreview from '@/components/DocumentPreview';
import SignaturePad from '@/components/SignaturePad';
import { SkeletonCard } from '@/components/Skeleton';
import type { Customer, DocumentBlock, Tenant } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { pageTitle } from '@/lib/constants';

interface PublicQuote {
  quote_number: string;
  quote_date: string;
  valid_until: string;
  currency: string;
  blocks: DocumentBlock[];
  signed_at: string | null;
  signed_name: string | null;
  signature_image: string | null;
  customer: Partial<Customer> | null;
}

/**
 * De pagina waar de klant terechtkomt via de knop in de mail. Geen inlog, geen
 * menu: alleen de offerte en het vak om te ondertekenen. De sleutel in het
 * adres is het enige wat deze pagina aan die ene klant koppelt.
 */
export default function PublicQuote() {
  const router = useRouter();
  const { token } = router.query;

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/public/quotes/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Er is iets misgegaan');
        return data;
      })
      .then((data) => {
        setQuote(data.quote);
        setTenant(data.tenant);
        setName(data.quote.signed_name || '');
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleSign = async () => {
    setSignError(null);

    if (!name.trim()) {
      setSignError('Vul uw naam in');
      return;
    }

    if (!signature) {
      setSignError('Zet uw handtekening in het vak');
      return;
    }

    setIsSigning(true);

    try {
      const response = await fetch(`/api/public/quotes/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), signature }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSignError(data.error || 'Er is iets misgegaan');
        setIsSigning(false);
        return;
      }

      setQuote((current) =>
        current
          ? { ...current, signed_at: data.signed_at, signed_name: name.trim(), signature_image: signature }
          : current
      );
    } catch {
      setSignError('Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsSigning(false);
    }
  };

  const isSigned = !!quote?.signed_at;

  /**
   * Staat er een handtekening-element in de offerte, dan tekent de klant daar —
   * op de plek die de aannemer zelf heeft gekozen. Offertes van vóór dat element
   * hebben het niet; die houden het losse blok onder het document.
   */
  const hasSignatureElement = (quote?.blocks || []).some((block) =>
    block.elements.some((element) => element.kind === 'handtekening')
  );

  const signingForm = (
    <>
      <p>
        Gaat u akkoord met deze offerte? Vul uw naam in en zet uw handtekening in het vak
        hieronder. Dat kan met uw vinger op de telefoon of met de muis.
      </p>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="signed_name">Uw naam</label>
          <input
            id="signed_name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Voor- en achternaam"
          />
        </div>
      </div>

      <SignaturePad onChange={setSignature} disabled={isSigning} />

      {signError && <p className="error-message">{signError}</p>}

      <div className="form-row">
        <button type="button" className="button" onClick={handleSign} disabled={isSigning}>
          {isSigning ? 'Bezig...' : 'Offerte ondertekenen'}
        </button>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <title>{pageTitle(quote ? `Offerte ${quote.quote_number}` : 'Offerte')}</title>
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
            <h2>Offerte niet gevonden</h2>
            <p>{loadError}</p>
          </div>
        )}

        {!isLoading && quote && (
          <>
            <div className="block">
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
                signature={{
                  image: quote.signature_image,
                  name: quote.signed_name,
                  signedAt: quote.signed_at,
                }}
                signatureField={hasSignatureElement && !isSigned ? signingForm : undefined}
              />
            </div>

            {/* Bevestiging na het tekenen, en het vak zelf voor offertes zonder element */}
            {isSigned ? (
              <div className="block signature-block">
                <p className="confirmation">
                  <CircleCheck size={18} />
                  <span>
                    Ondertekend door {quote.signed_name} op {formatDate(quote.signed_at!)}
                  </span>
                </p>
              </div>
            ) : (
              !hasSignatureElement && (
                <div className="block signature-block">
                  <h2>Handtekening klant</h2>
                  {signingForm}
                </div>
              )
            )}
          </>
        )}
      </div>
    </>
  );
}
