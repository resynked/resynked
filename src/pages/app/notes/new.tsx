import HelpButton from '@/components/HelpButton';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import NoteFields, { validateNote } from '@/components/NoteFields';
import type { Customer } from '@/lib/supabase';
import { getCustomerOptionLabel } from '@/lib/utils';

export default function NewNote() {
  const toast = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    content: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  // Pas na de eerste keer opslaan tonen wat er ontbreekt, niet al bij het openen
  const [showErrors, setShowErrors] = useState(false);

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
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      // Navigate back to notes or to customer page if came from there
      if (router.query.from === 'customer' && formData.customer_id) {
        router.push(`/app/customers/${formData.customer_id}`);
      } else {
        router.push('/app/notes');
      }
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: getCustomerOptionLabel(c),
  })) || [];

  return (
    <Layout title="Nieuwe notitie">
      <div className="header">
        <h1>Nieuwe notitie aanmaken <HelpButton topic="notes" /></h1>
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
