import { useState, useEffect } from 'react';
import Layout from '@/components/admin/Layout';
import Table from '@/components/admin/Table';
import Link from 'next/link';
import { Pencil, Trash } from 'lucide-react';
import type { Product } from '@/lib/supabase';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
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

  return (
    <Layout>
      <div className="page-header">
        <h1>Producten</h1>
        <Link href="/products/new" className="button">
          Product toevoegen
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <h2>Geen producten</h2>
          <p>Je hebt nog geen producten toegevoegd. Begin met het toevoegen van je eerste product.</p>
        </div>
      ) : (
        <Table headers={['Naam', 'Beschrijving', 'Prijs', 'Voorraad', '']}>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.description || '-'}</td>
              <td>€{product.price.toFixed(2)}</td>
              <td>{product.stock}</td>
              <td className="actions">
                <Link href={`/products/${product.id}`} className="edit">
                  <Pencil size={15} />
                </Link>
                <Link href="" className="delete" onClick={() => handleDelete(product.id)}>
                  <Trash size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Layout>
  );
}
