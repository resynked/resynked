import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { pageTitle } from '@/lib/constants';
import { useToast } from '@/components/Toast';

/**
 * Wachtwoord vergeten: je vult je e-mailadres in en krijgt een link om een
 * nieuw wachtwoord te kiezen. Zelfde opmaak als de inlogpagina.
 */
export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Fout', 'Vul je e-mailadres in.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }
      setSent(true);
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{pageTitle('Wachtwoord vergeten')}</title>
      </Head>

      <div className="login-wrapper">
        <div className="login-block">
          <div className="logo">
            <Image src="/logo.svg" alt="Synbased Logo" width={60} height={60} priority />
          </div>
          <h1>Wachtwoord vergeten</h1>
          {sent ? (
            <div className="login-form">
              {/* Altijd dezelfde tekst, ook als het adres niet bestaat */}
              <p className="placeholder">
                Als er een account bij {email} hoort, staat er nu een mail in je inbox met een link om een nieuw
                wachtwoord te kiezen. De link is een uur geldig.
              </p>
              <Link href="/login" className="button">
                Terug naar inloggen
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <p className="placeholder">Vul je e-mailadres in. Je krijgt een link om een nieuw wachtwoord te kiezen.</p>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Vul je e-mailadres in"
              />
              <button className="button" type="submit" disabled={isLoading}>
                {isLoading ? 'Bezig met versturen...' : 'Link versturen'}
              </button>
              <Link href="/login" className="back">
                Terug naar inloggen
              </Link>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
