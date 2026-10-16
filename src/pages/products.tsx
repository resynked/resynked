import { useEffect, useRef, useState } from 'react';
import { Ellipsis, Package, Search } from 'lucide-react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Select from '@/components/Select';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { SkeletonTable } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { usePagination } from '@/hooks/usePagination';
import { invalidateProducts } from '@/hooks/useProducts';
import { UNITS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/supabase';

const unitOptions = UNITS.map(unit => ({ value: unit, label: unit }));

const EMPTY_FORM = { name: '', unit: '', price: '' };

/**
 * Producten: werk en materiaal dat je vaak gebruikt, met prijs en eenheid.
 * Typ je in de prijstabel een omschrijving, dan komen ze als suggestie; de
 * regel krijgt een kopie, dus een latere prijswijziging verandert geen oude
 * offertes.
 */
export default function Products() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Het venster om toe te voegen of te bewerken; editing is null bij een nieuw product
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const term = searchTerm.trim().toLowerCase();
  const filtered = term ? products.filter(p => p.name.toLowerCase().includes(term)) : products;
  const pagination = usePagination(filtered);

  const errors = {
    name: !form.name.trim() ? 'Geef het product een naam' : '',
    price: form.price === '' || Number(form.price) < 0 ? 'Vul een prijs in' : '',
  };
  const hasErrors = !!(errors.name || errors.price);

  useEffect(() => {
    fetch('/api/products')
      .then(res => (res.ok ? res.json() : []))
      .then(setProducts)
      .catch(() => toast.error('Fout', 'Producten konden niet geladen worden'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdownId(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openForm = (product: Product | null) => {
    setEditing(product);
    setForm(product ? { name: product.name, unit: product.unit || '', price: String(product.price) } : EMPTY_FORM);
    setShowErrors(false);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setShowErrors(true);
    if (hasErrors) {
      toast.error('Nog niet compleet', 'Vul de gemarkeerde velden in');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, unit: form.unit, price: form.price }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error('Fout', data.error || 'Opslaan mislukt');
        return;
      }

      setProducts(current =>
        (editing ? current.map(p => (p.id === data.id ? data : p)) : [...current, data]).sort((a, b) =>
          a.name.localeCompare(b.name, 'nl')
        )
      );
      setFormOpen(false);
      invalidateProducts();
      toast.success('Gelukt', editing ? 'Het product is bijgewerkt' : 'Het product is toegevoegd');
    } catch {
      toast.error('Fout', 'Opslaan mislukt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    setOpenDropdownId(null);
    const confirmed = await confirm({
      title: 'Product verwijderen',
      message: `${product.name} verwijderen? Offertes en facturen waarin hij al staat, blijven zoals ze zijn.`,
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Fout', 'Verwijderen mislukt');
      return;
    }
    setProducts(current => current.filter(p => p.id !== product.id));
    invalidateProducts();
    toast.success('Verwijderd', `${product.name} is verwijderd`);
  };

  return (
    <Layout title="Producten">
      <div className="header">
        <h1>Producten</h1>
        <div className="actions">
          <SearchInput value={searchTerm} label="Zoeken in producten" onChange={setSearchTerm} />
          <button type="button" className="button" onClick={() => openForm(null)}>
            Product toevoegen
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={4} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {searchTerm ? <Search size={22} /> : <Package size={22} />}
          <h2>{searchTerm ? 'Geen producten gevonden' : 'Nog geen producten'}</h2>
          <p>
            {searchTerm
              ? 'Probeer een andere zoekterm.'
              : 'Zet hier je vaste werk en materiaal neer, zoals uurloon of m² tegelwerk. Typ je in een offerte of factuur een omschrijving, dan verschijnen ze als suggestie.'}
          </p>
        </div>
      ) : (
        <>
          <Table headers={['Product', 'Eenheid', 'Prijs excl. btw', '']}>
            {pagination.pageItems.map((product, index) => (
              <tr key={product.id}>
                <td className="note-cell">
                  <a
                    href="#"
                    className="title"
                    onClick={(e) => {
                      e.preventDefault();
                      openForm(product);
                    }}
                  >
                    {product.name}
                  </a>
                </td>
                <td>{product.unit || '-'}</td>
                <td>{formatCurrency(product.price)}</td>
                <td className="actions">
                  <div
                    // Onderaan de tabel klapt het menu omhoog, anders valt het buiten beeld
                    className={`action-dropdown${index >= pagination.pageItems.length - 4 && pagination.pageItems.length > 4 ? ' up' : ''}`}
                    ref={openDropdownId === product.id ? dropdownRef : null}
                  >
                    <button onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}>
                      <Ellipsis size={18} />
                    </button>
                    {openDropdownId === product.id && (
                      <div className="action-menu">
                        <a
                          href="#"
                          className="edit"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenDropdownId(null);
                            openForm(product);
                          }}
                        >
                          Bewerken
                        </a>
                        <a
                          href="#"
                          className="delete"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(product);
                          }}
                        >
                          Verwijderen
                        </a>
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Product bewerken' : 'Product toevoegen'}>
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="product_name">Naam</label>
            <input
              id="product_name"
              type="text"
              value={form.name}
              autoFocus
              aria-invalid={showErrors && !!errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Vul een naam in"
            />
            {showErrors && errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Eenheid</label>
              <Select
                value={unitOptions.find(o => o.value === form.unit) || null}
                onChange={(option) => setForm({ ...form, unit: option?.value || '' })}
                options={unitOptions}
                placeholder="Selecteer een eenheid"
                isClearable
              />
            </div>
            <div className="form-group">
              <label htmlFor="product_price">Prijs excl. btw</label>
              <input
                id="product_price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                aria-invalid={showErrors && !!errors.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="Vul een prijs in"
              />
              {showErrors && errors.price && <p className="field-error">{errors.price}</p>}
            </div>
          </div>
        </div>
        <div className="buttons">
          <button type="button" className="button cancel" onClick={() => setFormOpen(false)} disabled={isSaving}>
            Annuleren
          </button>
          <button type="button" className="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
