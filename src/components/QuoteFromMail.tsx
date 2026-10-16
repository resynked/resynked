import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import ToolButton from '@/components/ToolButton';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { emptyElement, priceTable } from '@/lib/blocks';
import { plainTextToRichText } from '@/lib/richtext';
import { overDagen, vandaag } from '@/lib/utils';
import type { QuoteProposal } from '@/lib/ai/types';
import type { DocumentBlock } from '@/lib/supabase';

interface QuoteFromMailProps {
  threadId: string;
  onClose: () => void;
  /** Het antwoord dat om ontbrekende gegevens vraagt, om in het antwoordvenster te zetten */
  onReplyDraft: (html: string) => void;
}

type Item = QuoteProposal['quote']['items'][number];

const CUSTOMER_FIELDS: { key: keyof QuoteProposal['customer']; label: string; placeholder: string }[][] = [
  [
    { key: 'first_name', label: 'Voornaam', placeholder: 'Vul een voornaam in' },
    { key: 'middle_name', label: 'Tussenvoegsel', placeholder: 'Vul een tussenvoegsel in' },
    { key: 'last_name', label: 'Achternaam', placeholder: 'Vul een achternaam in' },
  ],
  [{ key: 'company_name', label: 'Bedrijf', placeholder: 'Vul een bedrijfsnaam in' }],
  [
    { key: 'email', label: 'E-mail', placeholder: 'Vul een e-mailadres in' },
    { key: 'phone', label: 'Telefoon', placeholder: 'Vul een telefoonnummer in' },
  ],
  [{ key: 'street_address', label: 'Straat en huisnummer', placeholder: 'Vul een straatnaam en huisnummer in' }],
  [
    { key: 'postal_code', label: 'Postcode', placeholder: 'Vul een postcode in' },
    { key: 'city', label: 'Plaats', placeholder: 'Vul een plaats in' },
  ],
];

const emptyItem = (): Item => ({ description: '', quantity: 1, unit: '', price: null, price_basis: '' });

/**
 * Een mail omzetten naar een offerte, met hulp van AI.
 *
 * De AI doet een voorstel: de klant, de regels met prijzen uit eerdere
 * offertes, wat er nog ontbreekt en een antwoord dat daarom vraagt. Alles is
 * hier aan te passen; pas met "Offerte aanmaken" worden de klant en een
 * conceptofferte echt aangemaakt.
 */
export default function QuoteFromMail({ threadId, onClose, onReplyDraft }: QuoteFromMailProps) {
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = useState<'loading' | 'review' | 'creating' | 'done' | 'error'>('loading');
  const [error, setError] = useState<{ message: string; reconnect: boolean } | null>(null);

  const [customer, setCustomer] = useState<QuoteProposal['customer'] | null>(null);
  const [matched, setMatched] = useState<{ id: number; name: string } | null>(null);
  const [useMatched, setUseMatched] = useState(true);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [reply, setReply] = useState('');
  const [prepareReply, setPrepareReply] = useState(true);
  const [created, setCreated] = useState<{ id: number; number: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/ai/quote-from-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setError({ message: data.error || 'De AI kon deze mail niet verwerken', reconnect: !!data.reconnect });
          setPhase('error');
          return;
        }

        const proposal: QuoteProposal = data.proposal;
        setCustomer(proposal.customer);
        setMatched(data.customer);
        setTitle(proposal.quote.title);
        setIntro(proposal.quote.intro);
        setItems(proposal.quote.items.length ? proposal.quote.items : [emptyItem()]);
        setMissing(proposal.missing);
        setReply(proposal.reply_draft);
        setPrepareReply(!!proposal.reply_draft.trim());
        setPhase('review');
      } catch {
        if (cancelled) return;
        setError({ message: 'De AI is niet bereikbaar. Probeer het opnieuw.', reconnect: false });
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const changeItem = (index: number, changes: Partial<Item>) =>
    setItems(current => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  /** Eerst de klant, als die nog niet bestaat; dan de offerte als concept. */
  const create = async () => {
    if (!customer) return;
    setPhase('creating');

    try {
      let customerId = matched && useMatched ? matched.id : null;

      if (!customerId) {
        const name =
          [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ') ||
          customer.company_name;

        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...customer, name }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'De klant kon niet worden aangemaakt');
        customerId = data.id;
      }

      const lines = items.filter(item => item.description.trim());
      const blocks: DocumentBlock[] = [
        {
          title: title.trim() || 'Offerte',
          elements: [
            emptyElement('gegevens'),
            ...(intro.trim() ? [{ ...emptyElement('tekst'), body: plainTextToRichText(intro) }] : []),
            priceTable(
              (lines.length ? lines : [{ ...emptyItem(), description: title.trim() || 'Werkzaamheden' }]).map(item => ({
                description: item.description.trim(),
                is_heading: false,
                quantity: Number(item.quantity) || 1,
                unit: item.unit.trim() || null,
                price: Number(item.price) || 0,
              }))
            ),
            emptyElement('handtekening'),
          ],
        },
      ];

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          quote_date: vandaag(),
          valid_until: overDagen(30),
          currency: 'EUR',
          blocks,
        }),
      });
      const quote = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(quote.error || 'De offerte kon niet worden aangemaakt');

      if (prepareReply && reply.trim()) onReplyDraft(plainTextToRichText(reply));

      setCreated({ id: quote.id, number: quote.quote_number });
      setPhase('done');
    } catch (err: any) {
      toast.error('Aanmaken mislukt', err.message);
      setPhase('review');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Omzetten naar offerte">
      <div className="quote-from-mail">
        {phase === 'loading' && (
          <>
            <p className="field-note">De AI leest de mail en zet een offerte klaar. Dat duurt meestal een paar seconden.</p>
            <Skeleton height="1.25rem" width="40%" style={{ margin: 'var(--space20) 0 var(--space10)' }} />
            <Skeleton height="6rem" style={{ marginBottom: 'var(--space20)' }} />
            <Skeleton height="1.25rem" width="40%" style={{ marginBottom: 'var(--space10)' }} />
            <Skeleton height="8rem" />
          </>
        )}

        {phase === 'error' && error && (
          <>
            <p>{error.message}</p>
            <div className="buttons">
              <button type="button" className="button cancel" onClick={onClose}>
                Sluiten
              </button>
              {error.reconnect && (
                <Link href="/settings?tab=plugins" className="button">
                  Naar Plug-ins
                </Link>
              )}
            </div>
          </>
        )}

        {(phase === 'review' || phase === 'creating') && customer && (
          <>
            <p className="field-note">Een voorstel van de AI. Controleer alles voordat je het aanmaakt.</p>

            <h3>Klant</h3>
            {matched && (
              <label className="toggle-label">
                <Toggle label="Bestaande klant gebruiken" checked={useMatched} onChange={setUseMatched} />
                <span>
                  Bestaande klant gebruiken: <strong>{matched.name}</strong>
                </span>
              </label>
            )}
            {(!matched || !useMatched) && (
              <div className="form-section">
                {CUSTOMER_FIELDS.map((row, rowIndex) => (
                  <div key={rowIndex} className="form-row">
                    {row.map(({ key, label, placeholder }) => (
                      <div key={key} className="form-group">
                        <label htmlFor={`proposal_${key}`}>{label}</label>
                        <input
                          id={`proposal_${key}`}
                          type="text"
                          value={customer[key]}
                          placeholder={placeholder}
                          onChange={(e) => setCustomer({ ...customer, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <h3>Offerte</h3>
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="proposal_title">Titel</label>
                <input
                  id="proposal_title"
                  type="text"
                  value={title}
                  placeholder="Vul een titel in"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="proposal_intro">Inleiding</label>
                <textarea
                  id="proposal_intro"
                  value={intro}
                  placeholder="Vul een inleiding in"
                  onChange={(e) => setIntro(e.target.value)}
                />
              </div>
            </div>

            <div className="proposal-items">
              <div className="proposal-item heading">
                <span>Omschrijving</span>
                <span>Aantal</span>
                <span>Eenheid</span>
                <span>Prijs excl. btw</span>
                <span />
              </div>
              {items.map((item, index) => (
                <div key={index} className="proposal-item">
                  <input
                    type="text"
                    value={item.description}
                    placeholder="Vul een omschrijving in"
                    aria-label="Omschrijving"
                    onChange={(e) => changeItem(index, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    placeholder="Vul een aantal in"
                    aria-label="Aantal"
                    onChange={(e) => changeItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                  <input
                    type="text"
                    value={item.unit}
                    placeholder="Vul een eenheid in"
                    aria-label="Eenheid"
                    onChange={(e) => changeItem(index, { unit: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price ?? ''}
                    placeholder="Vul een prijs in"
                    aria-label="Prijs per eenheid"
                    onChange={(e) =>
                      changeItem(index, { price: e.target.value === '' ? null : parseFloat(e.target.value), price_basis: '' })
                    }
                  />
                  <ToolButton
                    title="Regel verwijderen"
                    className="delete"
                    onClick={() => setItems(current => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={15} />
                  </ToolButton>
                  {item.price_basis && <span className="field-note">Prijs uit {item.price_basis}</span>}
                </div>
              ))}
              <button type="button" className="button add-item" onClick={() => setItems([...items, emptyItem()])}>
                + Regel
              </button>
            </div>

            {missing.length > 0 && (
              <>
                <h3>Ontbreekt nog</h3>
                <ul className="proposal-missing">
                  {missing.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {reply.trim() && (
              <>
                <h3>Antwoord aan de klant</h3>
                <div className="form-section">
                  <textarea
                    value={reply}
                    placeholder="Vul een antwoord in"
                    aria-label="Antwoord aan de klant"
                    onChange={(e) => setReply(e.target.value)}
                  />
                </div>
                <label className="toggle-label">
                  <Toggle label="Antwoord klaarzetten" checked={prepareReply} onChange={setPrepareReply} />
                  <span>Zet dit antwoord klaar onderin het gesprek, om na te lezen en te versturen</span>
                </label>
              </>
            )}

            <div className="buttons">
              <button type="button" className="button cancel" onClick={onClose}>
                Annuleren
              </button>
              <button type="button" className="button" disabled={phase === 'creating'} onClick={create}>
                {phase === 'creating' ? 'Aanmaken...' : 'Offerte aanmaken'}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && created && (
          <>
            <p>
              Offerte <strong>{created.number}</strong> staat klaar als concept.
              {prepareReply && reply.trim() && ' Je antwoord staat onderin het gesprek, klaar om na te lezen en te versturen.'}
            </p>
            <div className="buttons">
              <button type="button" className="button cancel" onClick={onClose}>
                Sluiten
              </button>
              <button type="button" className="button" onClick={() => router.push(`/quotes/${created.id}`)}>
                Offerte openen
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
