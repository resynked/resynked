import { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { pageTitle } from '@/lib/constants';

/**
 * De omlijsting van de website op khance.com: kop met menu, en de voet.
 * Wie al ingelogd is, ziet "Naar dashboard" in plaats van "Inloggen".
 */
export default function SiteLayout({
  title,
  description,
  children,
}: {
  /** Leeg voor de homepage: dan staat er alleen "Khance" in het tabblad */
  title?: string;
  description: string;
  children: ReactNode;
}) {
  const { status } = useSession();
  const loggedIn = status === 'authenticated';

  return (
    <div className="site">
      <Head>
        <title>{title ? pageTitle(title) : 'Khance - Offertes en facturen voor vakmensen'}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title ? pageTitle(title) : 'Khance'} />
        <meta property="og:description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="site-header">
        <div className="site-container">
          <Link href="/" className="site-logo" aria-label="Khance, naar de homepage">
            <Image src="/logo.svg" alt="" width={28} height={28} priority />
            <span>Khance</span>
          </Link>

          <nav className="site-nav" aria-label="Hoofdmenu">
            <Link href="/#functies">Functies</Link>
            <Link href="/#werkwijze">Werkwijze</Link>
            <Link href="/#prijzen">Prijzen</Link>
            <Link href="/#vragen">Vragen</Link>
          </nav>

          <div className="site-actions">
            {loggedIn ? (
              <Link href="/dashboard" className="button">
                Naar dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="button tertiary">
                  Inloggen
                </Link>
                <Link href="/demo" className="button">
                  Demo aanvragen
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-container">
          <div className="site-footer-brand">
            <Link href="/" className="site-logo">
              <Image src="/logo.svg" alt="" width={24} height={24} />
              <span>Khance</span>
            </Link>
            <p>Offertes, facturen en mail voor vakmensen. Alles op één plek.</p>
          </div>

          <div className="site-footer-links">
            <div>
              <span className="title">Product</span>
              <Link href="/#functies">Functies</Link>
              <Link href="/#prijzen">Prijzen</Link>
              <Link href="/demo">Demo aanvragen</Link>
            </div>
            <div>
              <span className="title">Account</span>
              <Link href="/login">Inloggen</Link>
              <Link href="/forgot-password">Wachtwoord vergeten</Link>
            </div>
            <div>
              <span className="title">Juridisch</span>
              <Link href="/privacy">Privacyverklaring</Link>
              <Link href="/terms">Algemene voorwaarden</Link>
            </div>
          </div>
        </div>

        <div className="site-container site-footer-bottom">
          <span>© {new Date().getFullYear()} Khance</span>
        </div>
      </footer>
    </div>
  );
}
