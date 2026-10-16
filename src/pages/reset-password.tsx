import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { MIN_PASSWORD_LENGTH, pageTitle } from '@/lib/constants';
import { useToast } from '@/components/Toast';

/**
 * De pagina achter de link in de herstelmail: twee keer het nieuwe wachtwoord,
 * en daarna terug naar inloggen. Zelfde opmaak als de inlogpagina.
 */
export default function ResetPassword() {
  const router = useRouter();
  const toast = useToast();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error('Fout', `Je nieuwe wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn.`);
      return;
    }
    if (password !== repeat) {
      toast.error('Fout', 'De wachtwoorden zijn niet hetzelfde.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }
      setDone(true);
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{pageTitle('Nieuw wachtwoord')}</title>
      </Head>

      <div className="login-wrapper">
        <div className="login-block">
          <div className="logo">
            <Image src="/logo.svg" alt="Khance Logo" width={60} height={60} priority />
          </div>
          <h1>Nieuw wachtwoord</h1>
          {done ? (
            <div className="login-form">
              <p className="placeholder">Je wachtwoord is gewijzigd. Je kunt nu inloggen met je nieuwe wachtwoord.</p>
              <Link href="/login" className="button">
                Naar inloggen
              </Link>
            </div>
          ) : router.isReady && !token ? (
            <div className="login-form">
              <p className="placeholder">Deze link is niet compleet. Vraag een nieuwe link aan.</p>
              <Link href="/forgot-password" className="button">
                Nieuwe link aanvragen
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <p className="placeholder">Kies een nieuw wachtwoord van minimaal {MIN_PASSWORD_LENGTH} tekens.</p>
              <input
                type="password"
                autoComplete="new-password"
                autoFocus
                aria-label="Nieuw wachtwoord"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Vul een nieuw wachtwoord in"
              />
              <input
                type="password"
                autoComplete="new-password"
                aria-label="Nieuw wachtwoord herhalen"
                value={repeat}
                onChange={e => setRepeat(e.target.value)}
                placeholder="Vul het wachtwoord nogmaals in"
              />
              <button className="button" type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : 'Wachtwoord opslaan'}
              </button>
              <Link href="/forgot-password" className="back">
                Nieuwe link aanvragen
              </Link>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
