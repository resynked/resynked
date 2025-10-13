import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';

interface Invoice {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; email: string | null };
  total: number;
  status: string;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoices();
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

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;

    try {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(i => i.id));
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
    if (!confirm(`Weet je zeker dat je ${selectedIds.length} factu(u)r(en) wilt verwijderen?`)) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/invoices/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoices:', error);
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: invoice.customer_id,
          total: invoice.total,
          status: 'draft',
        }),
      });
      fetchInvoices();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating invoice:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'status-draft',
      sent: 'status-sent',
      paid: 'status-paid',
      cancelled: 'status-cancelled',
    };
    return <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>{status}</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Facturen</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/invoices/new" className="button">
            Factuur maken
          </Link>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <h2>Geen facturen</h2>
          <p>Je hebt nog geen facturen aangemaakt. Begin met het maken van je eerste factuur.</p>
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
                selectedIds.length === invoices.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === invoices.length
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
            'Factuur #',
            'Klant',
            'Totaal',
            'Status',
            'Datum',
            ''
          ]}
        >
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className={selectedIds.includes(invoice.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(invoice.id)}
                  aria-label={`Select row ${invoice.id}`}
                  onClick={() => handleSelectOne(invoice.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(invoice.id) && <Check size={14} />}
                </button>
              </td>
              <td>#{invoice.id.slice(0, 8)}</td>
              <td>{invoice.customer.name}</td>
              <td>€{invoice.total.toFixed(2)}</td>
              <td>{getStatusBadge(invoice.status)}</td>
              <td>{new Date(invoice.created_at).toLocaleDateString('nl-NL')}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === invoice.id ? dropdownRef : null}>
                  <button
                    className="action-trigger"
                    onClick={() => setOpenDropdownId(openDropdownId === invoice.id ? null : invoice.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === invoice.id && (
                    <div className="action-menu">
                      <Link href={`/invoices/${invoice.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link href="" className="copy" onClick={() => handleDuplicate(invoice)}>
                        Kopiëren
                      </Link>
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(invoice.id);
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
