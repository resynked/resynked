import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Modal from '@/components/Modal';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [toast, setToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error' | 'warning';
  }>({ show: false, title: '', message: '', variant: 'info' });

  const showToast = (title: string, message: string, variant: 'info' | 'success' | 'error' | 'warning') => {
    setToast({ show: true, title, message, variant });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email || !password) {
      showToast('Fout', 'Vul alle velden in.', 'error');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl: '/',
      });

      if (result?.error) {
        showToast('Fout', 'Ongeldige inloggegevens.', 'error');
        setIsLoading(false);
      } else {
        showToast('Succes', 'Succesvol ingelogd!', 'success');
        // Redirect to dashboard on successful login
        setTimeout(() => router.push('/'), 1000);
      }
    } catch (err) {
      showToast('Fout', 'Er is iets misgegaan. Probeer het opnieuw.', 'error');
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
            {error && <div className="login-error">{error}</div>}
            <button className="button" type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig met inloggen...' : 'Login'}
            </button>
          </form>
          <div className="register">
              Nog geen account? <Link href="/register"> Registreer hier </Link>
          </div>
        </div>
      </div>

      <Modal
        isOpen={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.title}
        type="toast"
        variant={toast.variant}
        autoClose={true}
        autoCloseDuration={5000}
      >
        {toast.message}
      </Modal>
    </>
  );
}