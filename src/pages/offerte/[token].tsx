import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CircleCheck } from 'lucide-react';
import DocumentPreview from '@/components/DocumentPreview';
import Modal from '@/components/Modal';
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
 * menu: alleen de offerte, en onderin een balk met de knop om te ondertekenen.
 * De sleutel in het adres is het enige wat deze pagina aan die ene klant koppelt.
 *
 * Het tekenen zelf gebeurt in een venster en niet in het document: een kolom
 * van het sjabloon is vaak te smal voor een naamveld en een tekenvak. In het
 * document staan tot dan de lijnen, en daarna de handtekening zelf.
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
  const [signOpen, setSignOpen] = useState(false);

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
      setSignOpen(false);
    } catch {
      setSignError('Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsSigning(false);
    }
  };

  const isSigned = !!quote?.signed_at;

  const signingForm = (
    <>
      <p>
        Vul uw naam in en zet uw handtekening in het vak hieronder. Dat kan met uw vinger op
        de telefoon of met de muis.
      </p>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="signed_name">Uw naam</label>
          <input
            id="signed_name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Vul uw voor- en achternaam in"
          />
        </div>
      </div>

      <SignaturePad onChange={setSignature} disabled={isSigning} />

      {signError && <p className="error-message">{signError}</p>}

      <div className="buttons">
        <button type="button" className="button cancel" onClick={() => setSignOpen(false)} disabled={isSigning}>
          Annuleren
        </button>
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
              />
            </div>

            {/* Onderin, altijd in beeld: tekenen, of de bevestiging daarvan */}
            <div className="island-bar rich-editor">
              <div className="toolbar">
                {isSigned ? (
                  <div className="group selection-count">
                    <CircleCheck size={15} />
                    <span>
                      Ondertekend door {quote.signed_name} op {formatDate(quote.signed_at!)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="group selection-count">
                      <span>Gaat u akkoord met deze offerte?</span>
                    </div>
                    <div className="group">
                      <button type="button" className="button" onClick={() => setSignOpen(true)}>
                        Ondertekenen
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Modal isOpen={signOpen && !isSigned} onClose={() => setSignOpen(false)} title="Offerte ondertekenen">
              {signingForm}
            </Modal>

          </>
        )}
      </div>
    </>
  );
}
