import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';


export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    tenantName: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password || !formData.name || !formData.tenantName) {
      setError('Vul alle velden in.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Wachtwoord moet minimaal 6 karakters bevatten.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          tenantName: formData.tenantName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Er is iets misgegaan.');
        setIsLoading(false);
        return;
      }

      // Registration successful, redirect to login
      alert('Account succesvol aangemaakt! U kunt nu inloggen.');
      router.push('/login');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="register-wrapper">
        <div className="register-block">
          <h1>Maak je account aan</h1>
          <form onSubmit={handleSubmit} className="register-form">
            <input
              id="tenantName"
              type="text"
              value={formData.tenantName}
              onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
              required
              placeholder="Bedrijfsnaam"
            />
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Uw naam"
            />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="E-mail"
            />
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="Wachtwoord"
            />
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              placeholder="Bevestig wachtwoord"
            />
            {error && <div className="register-error">{error}</div>}
            <button className="button" type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig met registreren...' : 'Registreer'}
            </button>
          </form>
          <div className="login">
               Heeft u al een account? <Link href="/login"> Log in</Link>
          </div>
        </div>
      </div>
    </>
  );
}
