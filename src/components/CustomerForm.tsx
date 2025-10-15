import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import Table from '@/components/Table';
import { Ellipsis, Check, Layers, ContactRound, FileText } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import type { Customer, ContactPerson, Note } from '@/lib/supabase';
import { SkeletonForm } from '@/components/Skeleton';

interface NoteWithCustomer extends Note {
  customer: {
    id: number;
    name: string;
  };
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
    debtor_number: '',
  });

  // Contact persons state (only for edit mode)
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);

  // Notes state (only for edit mode)
  const [notes, setNotes] = useState<NoteWithCustomer[]>([]);
  const [newContactPerson, setNewContactPerson] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    email: '',
    phone: '',
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editingContact, setEditingContact] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    email: '',
    phone: '',
  });
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Loading states
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(mode === 'edit');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);

  const genderOptions = [
    { value: 'Man', label: 'Man' },
    { value: 'Vrouw', label: 'Vrouw' },
  ];

  // Fetch customer data, contact persons, and notes (edit mode only)
  useEffect(() => {
    if (mode === 'edit' && customerId) {
      fetchCustomer();
      fetchContactPersons();
      fetchNotes();
    }
  }, [mode, customerId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          debtor_number: customer.debtor_number || '',
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

  const fetchContactPersons = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/contact-persons`);
      if (response.ok) {
        const data = await response.json();
        setContactPersons(data);
      }
    } catch (err) {
      console.error('Error fetching contact persons:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
        setError(data.error || 'Er is iets misgegaan');
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
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  // Contact person handlers (edit mode only)
  const handleAddContactPerson = async () => {
    if (!newContactPerson.first_name || !newContactPerson.last_name) {
      toast.warning('Waarschuwing', 'Voornaam en achternaam zijn verplicht');
      return;
    }

    setIsAddingContact(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/contact-persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContactPerson),
      });

      if (response.ok) {
        setNewContactPerson({
          first_name: '',
          middle_name: '',
          last_name: '',
          gender: '',
          email: '',
          phone: '',
        });
        setShowAddContact(false);
        toast.success('Gelukt', 'Contactpersoon succesvol toegevoegd');
        fetchContactPersons();
      } else {
        toast.error('Fout', 'Er ging iets mis bij het toevoegen van de contactpersoon');
      }
    } catch (err) {
      toast.error('Fout', 'Er ging iets mis bij het toevoegen van de contactpersoon');
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContactPerson = async (contactId: number) => {
    const confirmed = await confirm({
      title: 'Contactpersoon verwijderen',
      message: 'Weet je zeker dat je deze contactpersoon wilt verwijderen?',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/customers/${customerId}/contact-persons/${contactId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Gelukt', 'Contactpersoon succesvol verwijderd');
        setOpenDropdownId(null);
        fetchContactPersons();
      } else {
        toast.error('Fout', 'Er ging iets mis bij het verwijderen van de contactpersoon');
      }
    } catch (err) {
      toast.error('Fout', 'Er ging iets mis bij het verwijderen van de contactpersoon');
    }
  };

  const handleEditContactPerson = (contact: ContactPerson) => {
    setEditingContactId(contact.id);
    setEditingContact({
      first_name: contact.first_name || '',
      middle_name: contact.middle_name || '',
      last_name: contact.last_name || '',
      gender: contact.gender || '',
      email: contact.email || '',
      phone: contact.phone || '',
    });
    setShowAddContact(false);
    setOpenDropdownId(null);
  };

  const handleUpdateContactPerson = async () => {
    if (!editingContact.first_name || !editingContact.last_name) {
      toast.warning('Waarschuwing', 'Voornaam en achternaam zijn verplicht');
      return;
    }

    setIsEditingContact(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/contact-persons/${editingContactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingContact),
      });

      if (response.ok) {
        setEditingContactId(null);
        setEditingContact({
          first_name: '',
          middle_name: '',
          last_name: '',
          gender: '',
          email: '',
          phone: '',
        });
        toast.success('Gelukt', 'Contactpersoon succesvol bijgewerkt');
        fetchContactPersons();
      } else {
        toast.error('Fout', 'Er ging iets mis bij het bijwerken van de contactpersoon');
      }
    } catch (err) {
      toast.error('Fout', 'Er ging iets mis bij het bijwerken van de contactpersoon');
    } finally {
      setIsEditingContact(false);
    }
  };

  const handleSelectAllContacts = () => {
    if (selectedContactIds.length === contactPersons.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contactPersons.map(c => c.id));
    }
  };

  const handleSelectOneContact = (contactId: number) => {
    if (selectedContactIds.includes(contactId)) {
      setSelectedContactIds(selectedContactIds.filter(id => id !== contactId));
    } else {
      setSelectedContactIds([...selectedContactIds, contactId]);
    }
  };

  const handleBulkDeleteContacts = async () => {
    const confirmed = await confirm({
      title: 'Contactpersonen verwijderen',
      message: `Weet je zeker dat je ${selectedContactIds.length} contactpers${selectedContactIds.length === 1 ? 'oon' : 'onen'} wilt verwijderen?`,
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren'
    });

    if (!confirmed) return;

    try {
      await Promise.all(
        selectedContactIds.map(contactId =>
          fetch(`/api/customers/${customerId}/contact-persons/${contactId}`, { method: 'DELETE' })
        )
      );
      setSelectedContactIds([]);
      toast.success('Gelukt', 'Contactpersonen succesvol verwijderd');
      fetchContactPersons();
    } catch (err) {
      toast.error('Fout', 'Er ging iets mis bij het verwijderen van de contactpersonen');
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
              <span className="titel">Algemeen</span>
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

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="block page-navigation">
          <nav>
            <span className="titel">Algemeen</span>
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
            <Link
              href="#contactpersoon"
              className={`${activeTab === 'contactpersoon' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('contactpersoon');
              }}
            >
              <ContactRound size={18} />
              <span>Contactpersoon</span>
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
                <FileText size={18} />
                <span>Notities</span>
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
                      <label htmlFor="company_name">Bedrijfsnaam *</label>
                      <input
                        id="company_name"
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        required={!formData.first_name && !formData.last_name}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="debtor_number">Debiteurnummer</label>
                      <input
                        id="debtor_number"
                        type="text"
                        value={formData.debtor_number}
                        onChange={(e) => setFormData({ ...formData, debtor_number: e.target.value })}
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

            {/* Contactpersoon Tab */}
            {activeTab === 'contactpersoon' && (
              <div className="form-section">
                {mode === 'create' ? (
                  <div className="empty-state">
                    <h3>Contactpersonen</h3>
                    <p>Contactpersonen kunnen worden toegevoegd nadat de klant is aangemaakt.</p>
                  </div>
                ) : (
                  <>
                    <div className="header">
                      <h3>Contactpersonen</h3>
                      <div className="actions">
                        {selectedContactIds.length > 0 && (
                          <>
                            <span className="selected-count">{selectedContactIds.length} geselecteerd</span>
                            <button onClick={handleBulkDeleteContacts} className="button negative">
                              Verwijder
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            setShowAddContact(!showAddContact);
                            if (editingContactId) {
                              setEditingContactId(null);
                              setEditingContact({
                                first_name: '',
                                middle_name: '',
                                last_name: '',
                                gender: '',
                                email: '',
                                phone: '',
                              });
                            }
                          }}
                        >
                          {showAddContact ? 'Annuleren' : 'Contactpersoon toevoegen'}
                        </button>
                      </div>
                    </div>

                    {/* Add Contact Form */}
                    {showAddContact && (
                      <div className="form-section edit-holder">
                        <h4>Nieuwe contactpersoon</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="contact_first_name">Voornaam *</label>
                            <input
                              id="contact_first_name"
                              type="text"
                              value={newContactPerson.first_name}
                              onChange={(e) => setNewContactPerson({ ...newContactPerson, first_name: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="contact_middle_name">Tussenvoegsel</label>
                            <input
                              id="contact_middle_name"
                              type="text"
                              value={newContactPerson.middle_name}
                              onChange={(e) => setNewContactPerson({ ...newContactPerson, middle_name: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="contact_last_name">Achternaam *</label>
                            <input
                              id="contact_last_name"
                              type="text"
                              value={newContactPerson.last_name}
                              onChange={(e) => setNewContactPerson({ ...newContactPerson, last_name: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="contact_gender">Geslacht</label>
                            <Select
                              value={genderOptions.find(o => o.value === newContactPerson.gender) || null}
                              onChange={(option) => setNewContactPerson({ ...newContactPerson, gender: option?.value || '' })}
                              options={genderOptions}
                              placeholder="Selecteer geslacht..."
                              isClearable
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="contact_email">E-mailadres</label>
                            <input
                              id="contact_email"
                              type="email"
                              value={newContactPerson.email}
                              onChange={(e) => setNewContactPerson({ ...newContactPerson, email: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="contact_phone">Telefoonnummer</label>
                            <input
                              id="contact_phone"
                              type="tel"
                              value={newContactPerson.phone}
                              onChange={(e) => setNewContactPerson({ ...newContactPerson, phone: e.target.value })}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="button"
                          onClick={handleAddContactPerson}
                          disabled={isAddingContact}
                        >
                          {isAddingContact ? 'Toevoegen...' : 'Contactpersoon toevoegen'}
                        </button>
                      </div>
                    )}

                    {/* Edit Contact Form */}
                    {editingContactId && (
                      <div className="form-section edit-holder">
                        <h4>Contactpersoon bewerken</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="edit_first_name">Voornaam *</label>
                            <input
                              id="edit_first_name"
                              type="text"
                              value={editingContact.first_name}
                              onChange={(e) => setEditingContact({ ...editingContact, first_name: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="edit_middle_name">Tussenvoegsel</label>
                            <input
                              id="edit_middle_name"
                              type="text"
                              value={editingContact.middle_name}
                              onChange={(e) => setEditingContact({ ...editingContact, middle_name: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="edit_last_name">Achternaam *</label>
                            <input
                              id="edit_last_name"
                              type="text"
                              value={editingContact.last_name}
                              onChange={(e) => setEditingContact({ ...editingContact, last_name: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="edit_gender">Geslacht</label>
                            <Select
                              value={genderOptions.find(o => o.value === editingContact.gender) || null}
                              onChange={(option) => setEditingContact({ ...editingContact, gender: option?.value || '' })}
                              options={genderOptions}
                              placeholder="Selecteer geslacht..."
                              isClearable
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="edit_email">E-mailadres</label>
                            <input
                              id="edit_email"
                              type="email"
                              value={editingContact.email}
                              onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="edit_phone">Telefoonnummer</label>
                            <input
                              id="edit_phone"
                              type="tel"
                              value={editingContact.phone}
                              onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            className="button"
                            onClick={handleUpdateContactPerson}
                            disabled={isEditingContact}
                          >
                            {isEditingContact ? 'Bijwerken...' : 'Bijwerken'}
                          </button>
                          <button
                            type="button"
                            className="button cancel"
                            onClick={() => {
                              setEditingContactId(null);
                              setEditingContact({
                                first_name: '',
                                middle_name: '',
                                last_name: '',
                                gender: '',
                                email: '',
                                phone: '',
                              });
                            }}
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Contact Persons Table */}
                    {contactPersons.length === 0 ? (
                      <div className="empty-state">
                        <p>Nog geen contactpersonen toegevoegd.</p>
                      </div>
                    ) : (
                      <Table
                        headers={[
                          <button
                            key="select-all"
                            type="button"
                            role="checkbox"
                            className="checkbox"
                            aria-checked={
                              selectedContactIds.length === contactPersons.length
                                ? true
                                : selectedContactIds.length === 0
                                  ? false
                                  : "mixed"
                            }
                            data-state={
                              selectedContactIds.length === contactPersons.length
                                ? "checked"
                                : selectedContactIds.length === 0
                                  ? "unchecked"
                                  : "indeterminate"
                            }
                            aria-label="Select all rows"
                            onClick={handleSelectAllContacts}
                          >
                            {(selectedContactIds.length > 0) && <Check size={14} />}
                          </button>,
                          'ID',
                          'Naam',
                          'E-mailadres',
                          'Telefoonnummer',
                          ''
                        ]}
                      >
                        {contactPersons.map((contact) => {
                          const nameParts = [contact.first_name, contact.middle_name, contact.last_name].filter(Boolean);
                          const fullName = nameParts.join(' ');

                          return (
                            <tr
                              key={contact.id}
                              className={selectedContactIds.includes(contact.id) ? 'selected' : ''}
                            >
                              <td>
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={selectedContactIds.includes(contact.id)}
                                  aria-label={`Select row ${fullName}`}
                                  onClick={() => handleSelectOneContact(contact.id)}
                                  className="checkbox"
                                >
                                  {selectedContactIds.includes(contact.id) && <Check size={14} />}
                                </button>
                              </td>
                              <td>{contact.id}</td>
                              <td>{fullName}</td>
                              <td>{contact.email || '-'}</td>
                              <td>{contact.phone || '-'}</td>
                              <td className="actions">
                                <div className="action-dropdown" ref={openDropdownId === contact.id ? dropdownRef : null}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenDropdownId(openDropdownId === contact.id ? null : contact.id)}
                                  >
                                    <Ellipsis size={18} />
                                  </button>
                                  {openDropdownId === contact.id && (
                                    <div className="action-menu">
                                      <Link
                                        href=""
                                        className="edit"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleEditContactPerson(contact);
                                        }}
                                      >
                                        Bewerken
                                      </Link>
                                      <Link
                                        href=""
                                        className="delete"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleDeleteContactPerson(contact.id);
                                        }}
                                      >
                                        Verwijderen
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Table>
                    )}
                  </>
                )}
              </div>
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
                  <div style={{ marginTop: '1rem' }}>
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          padding: '1rem',
                          marginBottom: '1rem',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--surface-color)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                          <Link
                            href={`/notes/${note.id}`}
                            style={{
                              fontSize: '1rem',
                              fontWeight: 500,
                              color: 'var(--primary-color)',
                              textDecoration: 'none'
                            }}
                          >
                            {note.title}
                          </Link>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {new Date(note.created_at).toLocaleDateString('nl-NL', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          color: 'var(--text-secondary)',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
