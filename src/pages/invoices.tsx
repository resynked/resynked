import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import { SkeletonTable } from '@/components/Skeleton';
import Pagination from '@/components/Pagination';
import SelectionBar from '@/components/SelectionBar';
import ToolButton from '@/components/ToolButton';
import { usePagination } from '@/hooks/usePagination';
import Link from 'next/link';
import { Ellipsis, Check, Trash2, ReceiptEuro } from 'lucide-react';
import { formatCurrency, formatDate, getCustomerDisplayName, vandaag } from '@/lib/utils';
import { useConfirm } from '@/hooks/useConfirm';
import { copyBlocks } from '@/lib/blocks';
import { isCreditNote, isFinalInvoice } from '@/lib/invoices';
import type { Customer } from '@/lib/supabase';

interface Invoice {
  id: string;
  customer_id: string;
  customer: Pick<Customer, 'id' | 'name' | 'first_name' | 'middle_name' | 'last_name' | 'company_name' | 'email'> | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number;
  status: string;
  credit_for_invoice_id: number | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  paid: 'Betaald',
  cancelled: 'Geannuleerd',
};

export default function Invoices() {
  const { confirm } = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Tot de eerste lijst binnen is: anders staat er even "Geen ..." in beeld
  const [isLoading, setIsLoading] = useState(true);
  // Lange lijsten in pagina's; de selectie en het verwijderen gaan over de hele lijst
  const pagination = usePagination(invoices);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Factuur verwijderen',
      message: 'Weet je zeker dat je deze factuur wilt verwijderen?',
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

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

  // Alleen concepten kunnen weg; een verstuurde factuur hoort in de boekhouding
  const deletable = invoices.filter(i => selectedIds.includes(i.id) && !isFinalInvoice(i));

  const handleBulkDelete = async () => {
    const kept = selectedIds.length - deletable.length;

    const confirmed = await confirm({
      title: 'Facturen verwijderen',
      message: `Weet je zeker dat je ${deletable.length} concept(en) wilt verwijderen?${
        kept ? ` ${kept} verstuurde factu(u)r(en) blijven bewaard.` : ''
      }`,
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await Promise.all(
        deletable.map(invoice => fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoices:', error);
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    try {
      // Fetch full invoice details with items
      const response = await fetch(`/api/invoices/${invoice.id}`);
      const fullInvoice = await response.json();

      // Create new invoice with same data
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: fullInvoice.customer_id,
          invoice_date: vandaag(),
          due_date: fullInvoice.due_date,
          currency: fullInvoice.currency,
          intro_text: fullInvoice.intro_text,
          notes: fullInvoice.notes,
          status: 'draft',
          blocks: copyBlocks(fullInvoice.blocks),
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
    return (
      <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  return (
    <Layout title="Facturen">
      <div className="header">
        <h1>Facturen</h1>
        <div className="actions">
          <Link href="/invoices/new" className="button">
            Factuur maken
          </Link>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={10} columns={7} />
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <ReceiptEuro size={22} />
          <h2>Geen facturen</h2>
          <p>Je hebt nog geen facturen aangemaakt. Begin met het maken van je eerste factuur.</p>
        </div>
      ) : (
        <>
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
          {pagination.pageItems.map((invoice, index) => (
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
              <td>
                {invoice.invoice_number || `#${invoice.id}`}
                {isCreditNote(invoice) && <span className="placeholder"> · Credit</span>}
              </td>
              <td>{invoice.customer ? getCustomerDisplayName(invoice.customer) : '-'}</td>
              <td>{formatCurrency(invoice.total)}</td>
              <td>{getStatusBadge(invoice.status)}</td>
              <td>{formatDate(invoice.invoice_date || invoice.created_at)}</td>
              <td className="actions">
                <div
                  // Onderaan de tabel klapt het menu omhoog, anders valt het buiten beeld
                  className={`action-dropdown${index >= pagination.pageItems.length - 4 && pagination.pageItems.length > 4 ? ' up' : ''}`}
                  ref={openDropdownId === invoice.id ? dropdownRef : null}
                >
                  <button
                    className="action-trigger"
                    onClick={() => setOpenDropdownId(openDropdownId === invoice.id ? null : invoice.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === invoice.id && (
                    <div className="action-menu">
                      <Link href={`/invoices/${invoice.id}`} className="edit">
                        {isFinalInvoice(invoice) ? 'Bekijken' : 'Bewerken'}
                      </Link>
                      {!isCreditNote(invoice) && (
                        <Link href="" className="copy" onClick={() => handleDuplicate(invoice)}>
                          Kopiëren
                        </Link>
                      )}
                      {!isFinalInvoice(invoice) && (
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
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>

        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
        </>
      )}
      <SelectionBar count={selectedIds.length} noun={['factuur', 'facturen']} onClear={() => setSelectedIds([])}>
        <ToolButton title="Verwijderen" className="delete" disabled={deletable.length === 0} onClick={handleBulkDelete}>
          <Trash2 size={15} />
        </ToolButton>
      </SelectionBar>
    </Layout>
  );
}
