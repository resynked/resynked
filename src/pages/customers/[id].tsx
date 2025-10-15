import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from 'react-select';
import { X } from 'lucide-react';
import type { Customer, ContactPerson } from '@/lib/supabase';

export default function EditCustomer() {
  const router = useRouter();
  const { id } = router.query;
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

  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [newContactPerson, setNewContactPerson] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    email: '',
    phone: '',
  });
  const [showAddContact, setShowAddContact] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAddingContact, setIsAddingContact] = useState(false);

  const genderOptions = [
    { value: 'Man', label: 'Man' },
    { value: 'Vrouw', label: 'Vrouw' },
  ];

  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchContactPersons();
    }
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${id}`);
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
      const response = await fetch(`/api/customers/${id}/contact-persons`);
      if (response.ok) {
        const data = await response.json();
        setContactPersons(data);
      }
    } catch (err) {
      console.error('Error fetching contact persons:', err);
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
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
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
        setIsLoading(false);
        return;
      }

      router.push('/customers');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  const handleAddContactPerson = async () => {
    if (!newContactPerson.first_name || !newContactPerson.last_name) {
      alert('Voornaam en achternaam zijn verplicht');
      return;
    }

    setIsAddingContact(true);
    try {
      const response = await fetch(`/api/customers/${id}/contact-persons`, {
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
        fetchContactPersons();
      } else {
        alert('Er ging iets mis bij het toevoegen van de contactpersoon');
      }
    } catch (err) {
      alert('Er ging iets mis bij het toevoegen van de contactpersoon');
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContactPerson = async (contactId: string) => {
    if (!confirm('Weet je zeker dat je deze contactpersoon wilt verwijderen?')) return;

    try {
      const response = await fetch(`/api/customers/${id}/contact-persons/${contactId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchContactPersons();
      } else {
        alert('Er ging iets mis bij het verwijderen van de contactpersoon');
      }
    } catch (err) {
      alert('Er ging iets mis bij het verwijderen van de contactpersoon');
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
      <div className="header">
        <h1>Klant bewerken</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/customers')}>
            Annuleren
          </button>
          <button type="submit" form="customer-form" className="button" disabled={isLoading}>
            {isLoading ? 'Bijwerken...' : 'Bijwerken'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid left-2fr">
        <div className="block">
          <form id="customer-form" onSubmit={handleSubmit}>
            {/* Tabs */}
            <div className="tabs">
              <a
                href="#algemeen"
                className={`tab ${activeTab === 'algemeen' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('algemeen');
                }}
              >
                Algemeen
              </a>
              <a
                href="#contactpersoon"
                className={`tab ${activeTab === 'contactpersoon' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('contactpersoon');
                }}
              >
                Contactpersoon
              </a>
            </div>

            {/* Algemeen Tab */}
            {activeTab === 'algemeen' && (
              <>
                {/* Name Fields */}
                <div className="form-section">
                  <h3>Persoonlijke gegevens</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="first_name">Voornaam</label>
                      <input
                        id="first_name"
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
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
                      <label htmlFor="last_name">Achternaam</label>
                      <input
                        id="last_name"
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="gender">Geslacht</label>
                      <Select
                        value={genderOptions.find(o => o.value === formData.gender)}
                        onChange={(option) => setFormData({ ...formData, gender: option?.value || '' })}
                        options={genderOptions}
                        placeholder="Selecteer geslacht..."
                        className="react-select-container"
                        classNamePrefix="react-select"
                        isClearable
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="date_of_birth">Geboortedatum</label>
                      <input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div className="form-section">
                  <h3>Bedrijfsgegevens</h3>
                  <div className="form-group">
                    <label htmlFor="company_name">Bedrijfsnaam</label>
                    <input
                      id="company_name"
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
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

                {/* Financial */}
                <div className="form-section">
                  <h3>Financiële gegevens</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="iban">IBAN</label>
                      <input
                        id="iban"
                        type="text"
                        value={formData.iban}
                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
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
                </div>
              </>
            )}

            {/* Contactpersoon Tab */}
            {activeTab === 'contactpersoon' && (
              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>Contactpersonen</h3>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setShowAddContact(!showAddContact)}
                  >
                    {showAddContact ? 'Annuleren' : '+ Contactpersoon toevoegen'}
                  </button>
                </div>

                {/* Add Contact Form */}
                {showAddContact && (
                  <div className="form-section" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
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
                          value={genderOptions.find(o => o.value === newContactPerson.gender)}
                          onChange={(option) => setNewContactPerson({ ...newContactPerson, gender: option?.value || '' })}
                          options={genderOptions}
                          placeholder="Selecteer geslacht..."
                          className="react-select-container"
                          classNamePrefix="react-select"
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

                {/* Contact Persons List */}
                {contactPersons.length === 0 ? (
                  <div className="empty-state">
                    <p>Nog geen contactpersonen toegevoegd.</p>
                  </div>
                ) : (
                  <div className="contact-persons-list">
                    {contactPersons.map((contact) => {
                      const nameParts = [contact.first_name, contact.middle_name, contact.last_name].filter(Boolean);
                      const fullName = nameParts.join(' ');

                      return (
                        <div key={contact.id} className="contact-person-item" style={{
                          background: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          padding: '15px',
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{fullName}</div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {contact.gender && <span>{contact.gender} • </span>}
                              {contact.email && <span>{contact.email} • </span>}
                              {contact.phone && <span>{contact.phone}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="action delete"
                            onClick={() => handleDeleteContactPerson(contact.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            <X size={18} color="#ff4444" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
        </div>
    </Layout>
  );
}
