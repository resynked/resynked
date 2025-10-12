import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/admin/Layout';
import Link from 'next/link';
import type { Product } from '@/lib/supabase';

export default function EditProduct() {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image_url: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${id}`);
      if (response.ok) {
        const product: Product = await response.json();
        setFormData({
          name: product.name,
          description: product.description || '',
          price: product.price.toString(),
          stock: product.stock.toString(),
          image_url: product.image_url || '',
        });
      } else {
        setError('Product niet gevonden');
      }
    } catch (err) {
      setError('Fout bij het laden van productgegevens');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard/products');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <Layout>
        <div className="loading">Laden...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Product Bewerken</h1>
        <Link href="/dashboard/products" className="button button-secondary">
          Terug
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="name">Naam *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Beschrijving</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">Prijs (€) *</label>
              <input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="stock">Voorraad *</label>
              <input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="image_url">Afbeelding URL</label>
            <input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <Link href="/dashboard/products" className="button button-secondary">
              Annuleren
            </Link>
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Bijwerken...' : 'Product Bijwerken'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
