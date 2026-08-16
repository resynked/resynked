import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import { Layers, FilePen, FileText } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import type { Customer, Note } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QUOTE_STATUS } from '@/lib/constants';
import Table from '@/components/Table';
import { SkeletonForm } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: {
    id: number;
    name: string;
  };
}

/** Een offerte van deze klant, zoals hij in het overzicht bij de relatie staat. */
interface CustomerQuote {
  id: number;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  total: number;
  status: string;
}

interface CustomerFormProps {
  mode: 'create' | 'edit';
  customerId?: string;
}

export default function CustomerForm({ mode, customerId }: CustomerFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('algemeen');

  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    street_address: '',
    postal_code: '',
    city: '',
    date_of_birth: '',
    iban: '',
    kvk: '',
    btw_number: '',
    customer_number: '',
  });

  // Notes state (only for edit mode)
  const [notes, setNotes] = useState<NoteWithCustomer[]>([]);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(mode === 'edit');

  const genderOptions = [
    { value: 'Man', label: 'Man' },
    { value: 'Vrouw', label: 'Vrouw' },
  ];

  // Fetch customer data and notes (edit mode only)
  useEffect(() => {
    if (mode === 'edit' && customerId) {
      fetchCustomer();
      fetchNotes();
      fetchQuotes();
    }
  }, [mode, customerId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const customer: Customer = await response.json();
        setFormData({
          name: customer.name || '',
          first_name: customer.first_name || '',
          middle_name: customer.middle_name || '',
          last_name: customer.last_name || '',
          gender: customer.gender || '',
          company_name: customer.company_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          street_address: customer.street_address || '',
          postal_code: customer.postal_code || '',
          city: customer.city || '',
          date_of_birth: customer.date_of_birth || '',
          iban: customer.iban || '',
          kvk: customer.kvk || '',
          btw_number: customer.btw_number || '',
          customer_number: customer.customer_number || '',
        });
      } else {
        toast.error('Fout', 'Klant niet gevonden');
      }
    } catch (err) {
      toast.error('Fout', 'Fout bij het laden van klantgegevens');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/notes?customer_id=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  };

  const fetchQuotes = async () => {
    try {
      const response = await fetch(`/api/quotes?customer_id=${customerId}`);
      if (response.ok) setQuotes(await response.json());
    } catch (err) {
      console.error('Error fetching quotes:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Construct full name from parts
    const nameParts = [
      formData.first_name,
      formData.middle_name,
      formData.last_name
    ].filter(Boolean);
    const fullName = nameParts.join(' ') || formData.company_name || 'Unnamed';

    // Construct address from parts for compatibility
    const addressParts = [
      formData.street_address,
      formData.postal_code,
      formData.city
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    try {
      const url = mode === 'create' ? '/api/customers' : `/api/customers/${customerId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name: fullName,
          address: fullAddress,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      const successMessage = mode === 'create'
        ? 'Klant succesvol toegevoegd'
        : 'Klant succesvol bijgewerkt';

      toast.success('Gelukt', successMessage);
      router.push('/customers');
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <>
        <div className="header">
          <h1>Klant bewerken</h1>
          <div className="actions">
            <button type="button" className="button cancel" disabled>
              Annuleren
            </button>
            <button type="submit" className="button" disabled>
              Bijwerken
            </button>
          </div>
        </div>
        <div className="grid">
          <div className="block page-navigation">
            <nav>
              <span className="section-title">Algemeen</span>
              <Link href="#algemeen" className="active">
                <Layers size={18} />
                <span>Algemeen</span>
              </Link>
            </nav>
          </div>
          <SkeletonForm />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <h1>{mode === 'create' ? 'Nieuwe klant toevoegen' : 'Klant bewerken'}</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/customers')}>
            Annuleren
          </button>
          <button type="submit" form="customer-form" className="button" disabled={isLoading}>
            {isLoading ? (mode === 'create' ? 'Opslaan...' : 'Bijwerken...') : (mode === 'create' ? 'Opslaan' : 'Bijwerken')}
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="block page-navigation">
          <nav>
            <span className="section-title">Algemeen</span>
            <Link
              href="#algemeen"
              className={`${activeTab === 'algemeen' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('algemeen');
              }}
            >
              <Layers size={18} />
              <span>Algemeen</span>
            </Link>
            {mode === 'edit' && (
              <Link
                href="#notities"
                className={`${activeTab === 'notities' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('notities');
                }}
              >
                <FilePen size={18} />
                <span>Notities</span>
              </Link>
            )}
            {mode === 'edit' && (
              <Link
                href="#offertes"
                className={`${activeTab === 'offertes' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('offertes');
                }}
              >
                <FileText size={18} />
                <span>Offertes</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="block">
          <form id="customer-form" onSubmit={handleSubmit}>

            {/* Algemeen Tab */}
            {activeTab === 'algemeen' && (
              <>
                {/* Name Fields */}
                <div className="form-section">
                  <h3>Persoonlijke gegevens</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="first_name">Voornaam *</label>
                      <input
                        id="first_name"
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required={!formData.company_name}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="middle_name">Tussenvoegsel</label>
                      <input
                        id="middle_name"
                        type="text"
                        value={formData.middle_name}
                        onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="last_name">Achternaam *</label>
                      <input
                        id="last_name"
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required={!formData.company_name}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="gender">Geslacht</label>
                      <Select
                        value={genderOptions.find(o => o.value === formData.gender) || null}
                        onChange={(option) => setFormData({ ...formData, gender: option?.value || '' })}
                        options={genderOptions}
                        placeholder="Selecteer geslacht..."
                        isClearable
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="date_of_birth">Geboortedatum</label>
                      <DatePicker
                        value={formData.date_of_birth}
                        onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                        placeholder="Selecteer geboortedatum..."
                      />
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div className="form-section">
                  <h3>Bedrijfsgegevens</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="company_name">Bedrijfsnaam</label>
                      <input
                        id="company_name"
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer_number">Klantnummer</label>
                      <input
                        id="customer_number"
                        type="text"
                        value={formData.customer_number}
                        onChange={(e) => setFormData({ ...formData, customer_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="kvk">KVK</label>
                      <input
                        id="kvk"
                        type="text"
                        value={formData.kvk}
                        onChange={(e) => setFormData({ ...formData, kvk: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="btw_number">BTW-nummer</label>
                      <input
                        id="btw_number"
                        type="text"
                        value={formData.btw_number}
                        onChange={(e) => setFormData({ ...formData, btw_number: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="iban">IBAN</label>
                      <input
                        id="iban"
                        type="text"
                        value={formData.iban}
                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="form-section">
                  <h3>Contactgegevens</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">E-mailadres</label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Telefoonnummer</label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="form-section">
                  <h3>Adresgegevens</h3>
                  <div className="form-group">
                    <label htmlFor="street_address">Straatnaam en huisnummer</label>
                    <input
                      id="street_address"
                      type="text"
                      value={formData.street_address}
                      onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="postal_code">Postcode</label>
                      <input
                        id="postal_code"
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="city">Plaats</label>
                      <input
                        id="city"
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Notities Tab */}
            {activeTab === 'notities' && mode === 'edit' && (
              <div className="form-section">
                <div className="header">
                  <h3>Notities</h3>
                  <div className="actions">
                    <Link
                      href={`/notes/new?customer_id=${customerId}&from=customer`}
                      className="button"
                    >
                      Notitie toevoegen
                    </Link>
                  </div>
                </div>

                {notes.length === 0 ? (
                  <div className="empty-state">
                    <p>Nog geen notities toegevoegd voor deze klant.</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="form-section edit-holder">
                      <div className="header">
                        <h4>
                          <Link href={`/notes/${note.id}`}>{note.title}</Link>
                        </h4>
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                      <p>{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Offertes Tab */}
            {activeTab === 'offertes' && mode === 'edit' && (
              <div className="form-section">
                <div className="header">
                  <h3>Offertes</h3>
                  <div className="actions">
                    <Link href={`/quotes/new?customer_id=${customerId}`} className="button">
                      Offerte maken
                    </Link>
                  </div>
                </div>

                {quotes.length === 0 ? (
                  <div className="empty-state">
                    <p>Nog geen offertes voor deze klant.</p>
                  </div>
                ) : (
                  <Table headers={['Offerte #', 'Offertedatum', 'Geldig tot', 'Totaal', 'Status']}>
                    {quotes.map((quote) => (
                      <tr key={quote.id}>
                        <td>
                          <Link href={`/quotes/${quote.id}`}>{quote.quote_number}</Link>
                        </td>
                        <td>{formatDate(quote.quote_date)}</td>
                        <td>{formatDate(quote.valid_until)}</td>
                        <td>{formatCurrency(quote.total)}</td>
                        <td>
                          <span className={`status-badge ${QUOTE_STATUS[quote.status]?.className || ''}`}>
                            {QUOTE_STATUS[quote.status]?.label || quote.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
