import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { pageTitle } from '@/lib/constants';
import { useToast } from '@/components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl: '/',
      });

      if (result?.error) {
        toast.error('Fout', 'Ongeldige inloggegevens.');
        setIsLoading(false);
      } else {
        toast.success('Gelukt', 'Succesvol ingelogd!');
        // Terug naar de pagina waar je heen wilde, of anders het dashboard.
        // Alleen een pad binnen de app, geen adres van buiten
        const terug = router.query.callbackUrl;
        const doel = typeof terug === 'string' && terug.startsWith('/') && !terug.startsWith('//') ? terug : '/';
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
            <Image src="/logo.svg" alt="Khance Logo" width={60} height={60} priority />
          </div>
          <h1>Inloggen bij Khance</h1>
          <form onSubmit={handleSubmit} className="login-form">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Vul je e-mailadres in"
            />
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Vul je wachtwoord in"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                onClick={() => setShowPassword(show => !show)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button className="button" type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig met inloggen...' : 'Login'}
            </button>
          </form>
          <div className="register">
              Nog geen account? <Link href="/register"> Registreer hier </Link>
          </div>
        </div>
      </div>
    </>
  );
}