import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';

interface Quote {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; email: string | null };
  quote_number: string;
  quote_date: string;
  valid_until: string;
  total: number;
  status: string;
  created_at: string;
}

export default function Quotes() {
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
    if (!confirm('Weet je zeker dat je deze offerte wilt verwijderen?')) return;

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
    if (!confirm(`Weet je zeker dat je ${selectedIds.length} offerte(s) wilt verwijderen?`)) return;

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
      // Fetch full quote details with items
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
          tax_percentage: fullQuote.tax_percentage,
          discount_percentage: fullQuote.discount_percentage,
          notes: fullQuote.notes,
          items: fullQuote.quote_items?.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })) || [],
        }),
      });
      fetchQuotes();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating quote:', error);
    }
  };

  const handleConvertToOrder = async (quoteId: string) => {
    if (!confirm('Weet je zeker dat je deze offerte wilt omzetten naar een bestelling?')) return;

    try {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-order`, {
        method: 'POST',
      });
      const order = await response.json();

      // Refresh the quotes list to show updated status
      fetchQuotes();

      // Optionally redirect to the new order
      window.location.href = `/orders/${order.id}`;
    } catch (error) {
      console.error('Error converting quote to order:', error);
      alert('Er ging iets mis bij het omzetten van de offerte.');
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
    return <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>{status}</span>;
  };

  return (
    <Layout>
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
              <td>{quote.customer.name}</td>
              <td>€{quote.total.toFixed(2)}</td>
              <td>{getStatusBadge(quote.status)}</td>
              <td>{new Date(quote.valid_until).toLocaleDateString('nl-NL')}</td>
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
                      {quote.status === 'sent' || quote.status === 'draft' ? (
                        <Link
                          href=""
                          className="edit"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenDropdownId(null);
                            handleConvertToOrder(quote.id);
                          }}
                        >
                          Omzetten naar bestelling
                        </Link>
                      ) : null}
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
