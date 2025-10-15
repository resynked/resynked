import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check, Search } from 'lucide-react';
import type { Note } from '@/lib/supabase';
import { useConfirm } from '@/hooks/useConfirm';
import { SkeletonTable } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: {
    id: number;
    name: string;
  };
}

export default function Notes() {
  const { confirm } = useConfirm();
  const [notes, setNotes] = useState<NoteWithCustomer[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteWithCustomer[]>([]);
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
      const filtered = notes.filter((note) =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="header">
          <h1>Notities</h1>
          <div className="actions">
            <Link href="/notes/new" className="button">
              Notitie toevoegen
            </Link>
          </div>
        </div>
        <SkeletonTable rows={5} columns={6} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="header">
        <h1>Notities</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/notes/new" className="button">
            Notitie toevoegen
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="block" style={{ marginBottom: '1rem' }}>
        <div className="product-search-input">
          <Search size={16} />
          <input
            type="text"
            placeholder="Zoek notities op titel, inhoud of klantnaam..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="empty-state">
          <h2>{searchTerm ? 'Geen notities gevonden' : 'Geen notities'}</h2>
          <p>
            {searchTerm
              ? 'Probeer een andere zoekterm.'
              : 'Je hebt nog geen notities toegevoegd. Begin met het toevoegen van je eerste notitie.'}
          </p>
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
            'Titel',
            'Klant',
            'Inhoud',
            'Aangemaakt',
            ''
          ]}
        >
          {filteredNotes.map((note) => (
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
              <td>
                <Link href={`/notes/${note.id}`} style={{ fontWeight: 500 }}>
                  {note.title}
                </Link>
              </td>
              <td>
                <Link href={`/customers/${note.customer_id}`}>
                  {note.customer?.name || 'Onbekend'}
                </Link>
              </td>
              <td>
                <div style={{
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {note.content}
                </div>
              </td>
              <td>{formatDate(note.created_at)}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === note.id ? dropdownRef : null}>
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === note.id ? null : note.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === note.id && (
                    <div className="action-menu">
                      <Link href={`/notes/${note.id}`} className="edit">
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
      )}
    </Layout>
  );
}
