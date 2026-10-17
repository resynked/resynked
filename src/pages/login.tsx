import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { TOO_MANY_ATTEMPTS, TWO_FACTOR_INVALID, TWO_FACTOR_REQUIRED, pageTitle } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import PasswordInput from '@/components/PasswordInput';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Tweede stap: na een juist wachtwoord de code uit de authenticator-app
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email || !password) {
      toast.error('Fout', 'Vul alle velden in.');
      return;
    }
    if (needsCode && !code.trim()) {
      toast.error('Fout', 'Vul de code uit je authenticator-app in.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        ...(needsCode ? { code: code.trim() } : {}),
        callbackUrl: '/dashboard',
      });

      if (result?.error === TWO_FACTOR_REQUIRED) {
        // Wachtwoord klopt; nu nog de code
        setNeedsCode(true);
        setIsLoading(false);
      } else if (result?.error === TOO_MANY_ATTEMPTS) {
        toast.error('Even wachten', 'Te vaak een verkeerd wachtwoord of code. Probeer het over 15 minuten opnieuw.');
        setIsLoading(false);
      } else if (result?.error === TWO_FACTOR_INVALID) {
        toast.error('Fout', 'Deze code klopt niet. Probeer de code die nu in de app staat.');
        setCode('');
        setIsLoading(false);
      } else if (result?.error) {
        toast.error('Fout', 'Ongeldige inloggegevens.');
        setIsLoading(false);
      } else {
        toast.success('Gelukt', 'Succesvol ingelogd!');
        // Terug naar de pagina waar je heen wilde, of anders het dashboard.
        // Alleen een pad binnen de app, geen adres van buiten
        const terug = router.query.callbackUrl;
        const doel = typeof terug === 'string' && terug.startsWith('/') && !terug.startsWith('//') ? terug : '/dashboard';
        setTimeout(() => router.push(doel), 1000);
      }
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{pageTitle('Inloggen')}</title>
      </Head>

      <div className="login-wrapper">
        <div className="login-block">
          <div className="logo">
            <Image src="/logo.svg" alt="Synbased Logo" width={60} height={60} priority />
          </div>
          <h1>{needsCode ? 'Tweestapsverificatie' : 'Inloggen bij Synbased'}</h1>
          {needsCode && (
            <form onSubmit={handleSubmit} className="login-form">
              <p className="placeholder">Vul de code van 6 cijfers uit je authenticator-app in, of een van je back-upcodes.</p>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Vul de code in"
              />
              <button className="button" type="submit" disabled={isLoading}>
                {isLoading ? 'Bezig met controleren...' : 'Bevestigen'}
              </button>
              <button
                type="button"
                className="back"
                onClick={() => {
                  setNeedsCode(false);
                  setCode('');
                }}
              >
                Terug
              </button>
            </form>
          )}
          {!needsCode && (
          <form onSubmit={handleSubmit} className="login-form">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Vul je e-mailadres in"
            />
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              label="Wachtwoord"
              placeholder="Vul je wachtwoord in"
            />
            <button className="button" type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig met inloggen...' : 'Login'}
            </button>
            <Link href="/forgot-password" className="back">
              Wachtwoord vergeten?
            </Link>
          </form>
          )}
          <div className="register">
              Nog geen account? <Link href="/register"> Registreer hier </Link>
          </div>
        </div>
      </div>
    </>
  );
}