import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';
import type { Product } from '@/lib/supabase';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
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

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) return;

    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
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
    if (!confirm(`Weet je zeker dat je ${selectedIds.length} product(en) wilt verwijderen?`)) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting products:', error);
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${product.name} (kopie)`,
          description: product.description,
          price: product.price,
          stock: product.stock,
        }),
      });
      fetchProducts();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating product:', error);
    }
  };

  return (
    <Layout>
      <div className="header">
        <h1>Producten</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/products/new" className="button">
            Product toevoegen
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <h2>Geen producten</h2>
          <p>Je hebt nog geen producten toegevoegd. Begin met het toevoegen van je eerste product.</p>
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
                selectedIds.length === products.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === products.length
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
            'Naam',
            'Beschrijving',
            'Prijs',
            'Voorraad',
            ''
          ]}
        >
          {products.map((product) => (
            <tr
              key={product.id}
              className={selectedIds.includes(product.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(product.id)}
                  aria-label={`Select row ${product.name}`}
                  onClick={() => handleSelectOne(product.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(product.id) && <Check size={14} />}
                </button>
              </td>
              <td>{product.name}</td>
              <td>{product.description || '-'}</td>
              <td>€{product.price.toFixed(2)}</td>
              <td>{product.stock}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === product.id ? dropdownRef : null}>
                  <button
                    className="action-trigger"
                    onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                  >
                     <Ellipsis size={18} />
                  </button>
                  {openDropdownId === product.id && (
                    <div className="action-menu">
                      <Link href={`/products/${product.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link href="" className="copy" onClick={() => handleDuplicate(product)}>
                        Kopiëren
                      </Link>
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(product.id);
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
