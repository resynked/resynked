import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/admin/Layout';
import Link from 'next/link';

interface Invoice {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; email: string | null };
  total: number;
  status: string;
  created_at: string;
}

export default function EditInvoice() {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    customer_id: '',
    status: 'draft',
    total: 0,
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      if (response.ok) {
        const invoice: Invoice = await response.json();
        setFormData({
          customer_id: invoice.customer_id,
          status: invoice.status,
          total: invoice.total,
        });
      } else {
        setError('Factuur niet gevonden');
      }
    } catch (err) {
      setError('Fout bij het laden van factuurgegevens');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/invoices');
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
        <h1>Factuur bewerken</h1>
        <div className="actions">
          <Link href="/invoices" className="button tertiary">
            Annuleren
          </Link>
          <button type="submit" className="button" disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Factuur bijwerken'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="status">Status *</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="draft">Concept</option>
              <option value="sent">Verzonden</option>
              <option value="paid">Betaald</option>
              <option value="cancelled">Geannuleerd</option>
            </select>
          </div>

          <div className="form-group">
            <label>Totaal</label>
            <div className="form-display-value">€{formData.total.toFixed(2)}</div>
            <p className="form-help-text">Het totaalbedrag kan niet worden gewijzigd na het aanmaken van de factuur.</p>
          </div>
        </form>
      </div>
    </Layout>
  );
}
