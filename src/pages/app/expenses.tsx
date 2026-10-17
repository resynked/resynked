import HelpButton from '@/components/HelpButton';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Ellipsis, Check, Trash2, Search, Receipt } from 'lucide-react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Pagination from '@/components/Pagination';
import SelectionBar from '@/components/SelectionBar';
import ToolButton from '@/components/ToolButton';
import SearchInput from '@/components/SearchInput';
import { SkeletonTable } from '@/components/Skeleton';
import { usePagination } from '@/hooks/usePagination';
import { useConfirm } from '@/hooks/useConfirm';
import { EXPENSE_STATUS } from '@/lib/constants';
import { categoryLabel } from '@/lib/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Expense } from '@/lib/supabase';

/** Bij het verwijderen: bonnetjes en inkoopfacturen horen zeven jaar bewaard te blijven */
const RETENTION_NOTE = 'Bonnetjes en inkoopfacturen moet je zeven jaar bewaren; verwijder alleen wat er per ongeluk in staat.';

/**
 * Kosten: inkoopfacturen en bonnetjes, met de btw die je terugkrijgt. Opgezet
 * zoals Notities: zoeken, selecteren en per rij een menu.
 */
export default function Expenses() {
  const { confirm } = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const term = searchTerm.trim().toLowerCase();
  const filtered = term
    ? expenses.filter((expense) =>
        [expense.supplier, expense.reference, expense.description, categoryLabel(expense.category)]
          .some(value => (value || '').toLowerCase().includes(term))
      )
    : expenses;
  // Lange lijsten in pagina's; de selectie en het verwijderen gaan over de hele lijst
  const pagination = usePagination(filtered);

  useEffect(() => {
    fetchExpenses();
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

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      setExpenses(res.ok ? await res.json() : []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Kostenpost verwijderen',
      message: `Weet je zeker dat je deze kostenpost en het bestand erbij wilt verwijderen? ${RETENTION_NOTE}`,
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(e => e.id));
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(selectedId => selectedId !== id) : [...selectedIds, id]);
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Kosten verwijderen',
      message: `Weet je zeker dat je ${selectedIds.length} kostenpost(en) wilt verwijderen? ${RETENTION_NOTE}`,
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/expenses/${id}`, { method: 'DELETE' })));
      setSelectedIds([]);
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expenses:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Kosten">
        <div className="header">
          <h1>Kosten <HelpButton topic="expenses" /></h1>
          <div className="actions">
            <Link href="/app/expenses/new" className="button">
              Kosten toevoegen
            </Link>
          </div>
        </div>
        <SkeletonTable rows={5} columns={7} />
      </Layout>
    );
  }

  return (
    <Layout title="Kosten">
      <div className="header">
        <h1>Kosten <HelpButton topic="expenses" /></h1>
        <div className="actions">
          <SearchInput value={searchTerm} label="Zoeken in kosten" onChange={setSearchTerm} />
          <Link href="/app/expenses/new" className="button">
            Kosten toevoegen
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {searchTerm ? <Search size={22} /> : <Receipt size={22} />}
          <h2>{searchTerm ? 'Geen kosten gevonden' : 'Geen kosten'}</h2>
          <p>
            {searchTerm
              ? 'Probeer een andere zoekterm.'
              : 'Voeg je eerste bonnetje of inkoopfactuur toe. Met een AI-plug-in worden de gegevens vanzelf ingevuld.'}
          </p>
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
                  selectedIds.length === filtered.length ? true : selectedIds.length === 0 ? false : 'mixed'
                }
                data-state={
                  selectedIds.length === filtered.length ? 'checked' : selectedIds.length === 0 ? 'unchecked' : 'indeterminate'
                }
                aria-label="Select all rows"
                onClick={handleSelectAll}
              >
                {selectedIds.length > 0 && <Check size={14} />}
              </button>,
              'Leverancier',
              'Categorie',
              'Datum',
              'Totaal',
              'Btw',
              'Status',
              '',
            ]}
          >
            {pagination.pageItems.map((expense, index) => (
              <tr key={expense.id} className={selectedIds.includes(expense.id) ? 'selected' : ''}>
                <td>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedIds.includes(expense.id)}
                    aria-label={`Select row ${expense.supplier}`}
                    onClick={() => handleSelectOne(expense.id)}
                    className="checkbox"
                  >
                    {selectedIds.includes(expense.id) && <Check size={14} />}
                  </button>
                </td>
                <td className="note-cell">
                  <Link href={`/app/expenses/${expense.id}`} className="title">
                    {expense.supplier}
                  </Link>
                </td>
                <td>{categoryLabel(expense.category)}</td>
                <td>{formatDate(expense.expense_date)}</td>
                <td>{formatCurrency(expense.total)}</td>
                <td>{formatCurrency(expense.vat_amount)}</td>
                <td>
                  <span className={`status-badge ${EXPENSE_STATUS[expense.status]?.className || ''}`}>
                    {EXPENSE_STATUS[expense.status]?.label || expense.status}
                  </span>
                </td>
                <td className="actions">
                  <div
                    // Onderaan de tabel klapt het menu omhoog, anders valt het buiten beeld
                    className={`action-dropdown${index >= pagination.pageItems.length - 4 && pagination.pageItems.length > 4 ? ' up' : ''}`}
                    ref={openDropdownId === expense.id ? dropdownRef : null}
                  >
                    <button onClick={() => setOpenDropdownId(openDropdownId === expense.id ? null : expense.id)}>
                      <Ellipsis size={18} />
                    </button>
                    {openDropdownId === expense.id && (
                      <div className="action-menu">
                        <Link href={`/app/expenses/${expense.id}`} className="edit">
                          Bewerken
                        </Link>
                        <Link
                          href=""
                          className="delete"
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleDelete(expense.id);
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

          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </>
      )}
      <SelectionBar count={selectedIds.length} noun={['kostenpost', 'kostenposten']} onClear={() => setSelectedIds([])}>
        <ToolButton title="Verwijderen" className="delete" onClick={handleBulkDelete}>
          <Trash2 size={15} />
        </ToolButton>
      </SelectionBar>
    </Layout>
  );
}
