import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // Redirect to dashboard on successful login
        setTimeout(() => router.push('/'), 1000);
      }
    } catch (err) {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="login-wrapper">
        <div className="login-block">
          <h1>Inloggen bij Resynked</h1>
          <form onSubmit={handleSubmit} className="login-form">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="E-mail"
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Wachtwoord"
            />
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