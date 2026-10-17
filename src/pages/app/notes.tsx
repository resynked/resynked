import HelpButton from '@/components/HelpButton';
import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Pagination from '@/components/Pagination';
import SelectionBar from '@/components/SelectionBar';
import ToolButton from '@/components/ToolButton';
import SearchInput from '@/components/SearchInput';
import { usePagination } from '@/hooks/usePagination';
import Link from 'next/link';
import { Ellipsis, Check, Trash2, Search, FilePen } from 'lucide-react';
import type { Customer, Note } from '@/lib/supabase';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDate, getCustomerDisplayName } from '@/lib/utils';
import { SkeletonTable } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: Pick<Customer, 'id' | 'name' | 'first_name' | 'middle_name' | 'last_name' | 'company_name'> | null;
}

export default function Notes() {
  const { confirm } = useConfirm();
  const [notes, setNotes] = useState<NoteWithCustomer[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteWithCustomer[]>([]);
  // Lange lijsten in pagina's; de selectie en het verwijderen gaan over de hele lijst
  const pagination = usePagination(filteredNotes);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();
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

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredNotes(notes);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = notes.filter((note) =>
        note.title.toLowerCase().includes(term) ||
        // De inhoud is HTML; zoeken in de tekst, niet in de tags
        note.content.replace(/<[^>]*>/g, ' ').toLowerCase().includes(term) ||
        (note.customer ? getCustomerDisplayName(note.customer).toLowerCase().includes(term) : false)
      );
      setFilteredNotes(filtered);
    }
  }, [searchTerm, notes]);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data);
      setFilteredNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Notitie verwijderen',
      message: 'Weet je zeker dat je deze notitie wilt verwijderen?',
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotes.map(n => n.id));
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Notities verwijderen',
      message: `Weet je zeker dat je ${selectedIds.length} notitie(s) wilt verwijderen?`,
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchNotes();
    } catch (error) {
      console.error('Error deleting notes:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Notities">
        <div className="header">
          <h1>Notities <HelpButton topic="notes" /></h1>
          <div className="actions">
            <Link href="/app/notes/new" className="button">
              Notitie toevoegen
            </Link>
          </div>
        </div>
        <SkeletonTable rows={5} columns={5} />
      </Layout>
    );
  }

  return (
    <Layout title="Notities">
      <div className="header">
        <h1>Notities <HelpButton topic="notes" /></h1>
        <div className="actions">
          <SearchInput value={searchTerm} label="Zoeken in notities" onChange={setSearchTerm} />
          <Link href="/app/notes/new" className="button">
            Notitie toevoegen
          </Link>
        </div>
      </div>


      {filteredNotes.length === 0 ? (
        <div className="empty-state">
          {searchTerm ? <Search size={22} /> : <FilePen size={22} />}
          <h2>{searchTerm ? 'Geen notities gevonden' : 'Geen notities'}</h2>
          <p>
            {searchTerm
              ? 'Probeer een andere zoekterm.'
              : 'Je hebt nog geen notities toegevoegd. Begin met het toevoegen van je eerste notitie.'}
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
                selectedIds.length === filteredNotes.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === filteredNotes.length
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
            'Notitie',
            'Klant',
            'Laatst bewerkt',
            ''
          ]}
        >
          {pagination.pageItems.map((note, index) => (
            <tr
              key={note.id}
              className={selectedIds.includes(note.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(note.id)}
                  aria-label={`Select row ${note.title}`}
                  onClick={() => handleSelectOne(note.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(note.id) && <Check size={14} />}
                </button>
              </td>
              <td className="note-cell">
                <Link href={`/app/notes/${note.id}`} className="title">
                  {note.title}
                </Link>
              </td>
              <td>
                {note.customer ? (
                  <Link href={`/app/customers/${note.customer.id}`}>{getCustomerDisplayName(note.customer)}</Link>
                ) : (
                  '-'
                )}
              </td>
              <td>{formatDate(note.updated_at || note.created_at)}</td>
              <td className="actions">
                <div
                  // Onderaan de tabel klapt het menu omhoog, anders valt het buiten beeld
                  className={`action-dropdown${index >= pagination.pageItems.length - 4 && pagination.pageItems.length > 4 ? ' up' : ''}`}
                  ref={openDropdownId === note.id ? dropdownRef : null}
                >
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === note.id ? null : note.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === note.id && (
                    <div className="action-menu">
                      <Link href={`/app/notes/${note.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(note.id);
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
      <SelectionBar count={selectedIds.length} noun={['notitie', 'notities']} onClear={() => setSelectedIds([])}>
        <ToolButton title="Verwijderen" className="delete" onClick={handleBulkDelete}>
          <Trash2 size={15} />
        </ToolButton>
      </SelectionBar>
    </Layout>
  );
}
