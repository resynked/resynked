import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import type { Customer } from '@/lib/supabase';
import { getCustomerDisplayName } from '@/lib/utils';

export default function NewNote() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    content: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if customer_id was passed via query params
  useEffect(() => {
    const { customer_id } = router.query;
    if (customer_id && typeof customer_id === 'string') {
      setFormData(prev => ({ ...prev, customer_id }));
    }
  }, [router.query]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);

      // If customer_id not set and we have customers, set first one
      if (!formData.customer_id && data.length > 0) {
        setFormData(prev => ({ ...prev, customer_id: String(data[0].id) }));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/notes', {
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

      // Navigate back to notes or to customer page if came from there
      if (router.query.from === 'customer' && formData.customer_id) {
        router.push(`/customers/${formData.customer_id}`);
      } else {
        router.push('/notes');
      }
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: getCustomerDisplayName(c),
  })) || [];

  return (
    <Layout>
      <div className="header">
        <h1>Nieuwe notitie aanmaken</h1>
        <div className="actions">
          <button
            type="button"
            className="button cancel"
            onClick={() => router.back()}
          >
            Annuleren
          </button>
          <button
            type="submit"
            form="note-form"
            className="button"
            disabled={isLoading || !formData.title || !formData.content || !formData.customer_id}
          >
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="block">
        <form id="note-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="customer_id">Klant</label>
              <Select
                value={customerOptions.find(o => o.value === formData.customer_id) || null}
                onChange={(option) => setFormData({ ...formData, customer_id: option?.value || '' })}
                options={customerOptions}
                placeholder="Selecteer klant..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="title">Titel</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Notitie titel"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Inhoud</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Notitie inhoud..."
                rows={10}
                required
              />
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
