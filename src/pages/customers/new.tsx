import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Select from 'react-select';

export default function NewCustomer() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('algemeen');
  const [formData, setFormData] = useState({
    // Keep for compatibility, will be constructed from first_name + middle_name + last_name
    name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    company_name: '',
    email: '',
    phone: '',
    // Legacy field
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

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const genderOptions = [
    { value: 'Man', label: 'Man' },
    { value: 'Vrouw', label: 'Vrouw' },
  ];

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
      const response = await fetch('/api/customers', {
        method: 'POST',
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

  return (
    <Layout>
      <div className="page-header">
        <h1>Nieuwe klant toevoegen</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/customers')}>
            Annuleren
          </button>
          <button type="submit" form="customer-form" className="button" disabled={isLoading}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
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
                <div className="empty-state">
                  <h3>Contactpersonen</h3>
                  <p>Contactpersonen kunnen worden toegevoegd nadat de klant is aangemaakt.</p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
}
