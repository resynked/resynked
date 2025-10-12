import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/admin/Layout';
import Link from 'next/link';
import type { Customer } from '@/lib/supabase';

export default function EditCustomer() {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCustomer();
    }
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${id}`);
      if (response.ok) {
        const customer: Customer = await response.json();
        setFormData({
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
        });
      } else {
        setError('Klant niet gevonden');
      }
    } catch (err) {
      setError('Fout bij het laden van klantgegevens');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/customers/${id}`, {
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

      router.push('/dashboard/customers');
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
        <h1>Klant Bewerken</h1>
        <Link href="/dashboard/customers" className="button button-secondary">
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
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefoon</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Adres</label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-actions">
            <Link href="/dashboard/customers" className="button button-secondary">
              Annuleren
            </Link>
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Bijwerken...' : 'Klant Bijwerken'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
