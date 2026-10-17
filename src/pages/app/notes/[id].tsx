import HelpButton from '@/components/HelpButton';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import NoteFields, { validateNote } from '@/components/NoteFields';
import type { Customer, Note } from '@/lib/supabase';
import { getCustomerOptionLabel } from '@/lib/utils';
import { SkeletonForm } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: {
    id: number;
    name: string;
    email: string | null;
  };
}

export default function EditNote() {
  const toast = useToast();
  const router = useRouter();
  const { id } = router.query;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [note, setNote] = useState<NoteWithCustomer | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    content: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  // Pas na de eerste keer opslaan tonen wat er ontbreekt, niet al bij het openen
  const [showErrors, setShowErrors] = useState(false);
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
      toast.error('Fout', 'Notitie niet gevonden');
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
    // Ontbreekt er iets, dan rode randen en een melding in plaats van niets
    setShowErrors(true);
    if (Object.keys(validateNote(formData)).length > 0) {
      toast.error('Nog niet compleet', 'Vul de gemarkeerde velden in');
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/app/notes');
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: getCustomerOptionLabel(c),
  })) || [];

  if (isFetching) {
    return (
      <Layout title="Notitie bewerken">
        <div className="header">
          <h1>Notitie bewerken <HelpButton topic="notes" /></h1>
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
      <Layout title="Notitie bewerken">
        <div className="header">
          <h1>Notitie niet gevonden <HelpButton topic="notes" /></h1>
        </div>
        <div className="empty-state">
          <p>Deze notitie bestaat niet of is verwijderd.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Notitie bewerken">
      <div className="header">
        <h1>Notitie bewerken <HelpButton topic="notes" /></h1>
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
            disabled={isLoading}
          >
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      <div className="block">
        <form id="note-form" onSubmit={handleSubmit}>
          <NoteFields
            formData={formData}
            onChange={setFormData}
            customerOptions={customerOptions}
            errors={showErrors ? validateNote(formData) : {}}
          />
        </form>
      </div>
    </Layout>
  );
}
