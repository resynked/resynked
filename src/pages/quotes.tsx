import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';
import { formatCurrency, formatDate, getCustomerDisplayName } from '@/lib/utils';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/Toast';
import { copyBlocks } from '@/lib/blocks';
import type { Customer } from '@/lib/supabase';

interface Quote {
  id: string;
  customer_id: string;
  customer: Pick<Customer, 'id' | 'name' | 'first_name' | 'middle_name' | 'last_name' | 'company_name' | 'email'> | null;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  total: number;
  status: string;
  converted_to_invoice_id: number | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  expired: 'Verlopen',
};

export default function Quotes() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      const data = await res.json();
      setQuotes(data);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Offerte verwijderen',
      message: 'Weet je zeker dat je deze offerte wilt verwijderen?',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      fetchQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === quotes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(quotes.map(q => q.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Offertes verwijderen',
      message: `Weet je zeker dat je ${selectedIds.length} offerte(s) wilt verwijderen?`,
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/quotes/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchQuotes();
    } catch (error) {
      console.error('Error deleting quotes:', error);
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    try {
      // Fetch full quote details with blocks
      const response = await fetch(`/api/quotes/${quote.id}`);
      const fullQuote = await response.json();

      // Create new quote with same data
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: fullQuote.customer_id,
          quote_number: `${fullQuote.quote_number}-kopie`,
          quote_date: new Date().toISOString().split('T')[0],
          valid_until: fullQuote.valid_until,
          currency: fullQuote.currency,
          intro_text: fullQuote.intro_text,
          notes: fullQuote.notes,
          blocks: copyBlocks(fullQuote.blocks),
        }),
      });
      fetchQuotes();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating quote:', error);
    }
  };

  const handleSend = async (quoteId: string) => {
    const confirmed = await confirm({
      title: 'Offerte versturen',
      message:
        'De klant krijgt een mail met een knop naar deze offerte, waar hij hem kan bekijken en ondertekenen.',
      confirmText: 'Versturen',
      cancelText: 'Annuleren',
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        toast.error('Versturen mislukt', data.error || 'Er is iets misgegaan');
        return;
      }

      toast.success('Verstuurd', `De offerte is naar ${data.sentTo} gestuurd`);
      fetchQuotes();
    } catch (error) {
      console.error('Error sending quote:', error);
      toast.error('Versturen mislukt', 'Er is iets misgegaan. Probeer het opnieuw.');
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    const confirmed = await confirm({
      title: 'Omzetten naar factuur',
      message: 'Deze offerte omzetten naar een factuur? Alle regels worden overgenomen.',
      confirmText: 'Omzetten',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-invoice`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error('Omzetten mislukt', data.error || 'Er ging iets mis bij het omzetten van de offerte.');
        return;
      }

      router.push(`/invoices/${data.id}`);
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      toast.error('Omzetten mislukt', 'Er ging iets mis bij het omzetten van de offerte.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'status-draft',
      sent: 'status-sent',
      approved: 'status-paid',
      rejected: 'status-cancelled',
      expired: 'status-cancelled',
    };
    return (
      <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  return (
    <Layout title="Offertes">
      <div className="header">
        <h1>Offertes</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/quotes/new" className="button">
            Offerte maken
          </Link>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="empty-state">
          <h2>Geen offertes</h2>
          <p>Je hebt nog geen offertes aangemaakt. Begin met het maken van je eerste offerte.</p>
        </div>
      ) : (
        <Table
          headers={[
            <button
              key="select-all"
              type="button"
              role="checkbox"
              className="checkbox"
              aria-checked={
                selectedIds.length === quotes.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === quotes.length
                  ? "checked"
                  : selectedIds.length === 0
                    ? "unchecked"
                    : "indeterminate"
              }
              aria-label="Select all rows"
              onClick={handleSelectAll}
            >
              {(selectedIds.length > 0) && <Check size={14} />}
            </button>,
            'Offerte #',
            'Klant',
            'Totaal',
            'Status',
            'Geldig tot',
            ''
          ]}
        >
          {quotes.map((quote) => (
            <tr
              key={quote.id}
              className={selectedIds.includes(quote.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(quote.id)}
                  aria-label={`Select row ${quote.id}`}
                  onClick={() => handleSelectOne(quote.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(quote.id) && <Check size={14} />}
                </button>
              </td>
              <td>{quote.quote_number}</td>
              <td>{quote.customer ? getCustomerDisplayName(quote.customer) : '-'}</td>
              <td>{formatCurrency(quote.total)}</td>
              <td>{getStatusBadge(quote.status)}</td>
              <td>{formatDate(quote.valid_until)}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === quote.id ? dropdownRef : null}>
                  <button
                    className="action-trigger"
                    onClick={() => setOpenDropdownId(openDropdownId === quote.id ? null : quote.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === quote.id && (
                    <div className="action-menu">
                      <Link href={`/quotes/${quote.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link href="" className="copy" onClick={() => handleDuplicate(quote)}>
                        Kopiëren
                      </Link>
                      <Link
                        href=""
                        className="edit"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenDropdownId(null);
                          handleSend(quote.id);
                        }}
                      >
                        Versturen
                      </Link>
                      {quote.converted_to_invoice_id ? (
                        <Link href={`/invoices/${quote.converted_to_invoice_id}`} className="edit">
                          Bekijk factuur
                        </Link>
                      ) : (
                        <Link
                          href=""
                          className="edit"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenDropdownId(null);
                            handleConvertToInvoice(quote.id);
                          }}
                        >
                          Omzetten naar factuur
                        </Link>
                      )}
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(quote.id);
                        }}
                      >
                        Verwijderen
                      </Link>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Layout>
  );
}
