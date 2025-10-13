import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Link from 'next/link';

export default function NewCustomer() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/customers');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Nieuwe Klant Toevoegen</h1>
        <Link href="/customers" className="button button-secondary">
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
            <Link href="/customers" className="button cancel">
              Annuleren
            </Link>
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Toevoegen...' : 'Klant Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
