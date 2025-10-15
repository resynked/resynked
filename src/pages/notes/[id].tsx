import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from '@/components/Select';
import type { Customer, Note } from '@/lib/supabase';
import { getCustomerDisplayName } from '@/lib/utils';
import { SkeletonForm } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: {
    id: number;
    name: string;
    email: string | null;
  };
}

export default function EditNote() {
  const router = useRouter();
  const { id } = router.query;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [note, setNote] = useState<NoteWithCustomer | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    content: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (id) {
      fetchNote();
      fetchCustomers();
    }
  }, [id]);

  const fetchNote = async () => {
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error('Note not found');

      const data = await res.json();
      setNote(data);
      setFormData({
        customer_id: String(data.customer_id),
        title: data.title,
        content: data.content,
      });
      setIsFetching(false);
    } catch (error) {
      console.error('Error fetching note:', error);
      setError('Notitie niet gevonden');
      setIsFetching(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/notes/${id}`, {
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

      router.push('/notes');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: getCustomerDisplayName(c),
  })) || [];

  if (isFetching) {
    return (
      <Layout>
        <div className="header">
          <h1>Notitie bewerken</h1>
          <div className="actions">
            <button type="button" className="button cancel" disabled>
              Annuleren
            </button>
            <button type="submit" className="button" disabled>
              Opslaan
            </button>
          </div>
        </div>
        <SkeletonForm />
      </Layout>
    );
  }

  if (!note) {
    return (
      <Layout>
        <div className="header">
          <h1>Notitie niet gevonden</h1>
        </div>
        <div className="error-message">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="header">
        <h1>Notitie bewerken</h1>
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
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        </form>

        <div className="form-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Aangemaakt op: {new Date(note.created_at).toLocaleDateString('nl-NL', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {note.updated_at !== note.created_at && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Laatst bijgewerkt: {new Date(note.updated_at).toLocaleDateString('nl-NL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
