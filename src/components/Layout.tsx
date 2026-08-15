import { ReactNode } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { Skeleton } from './Skeleton';
import { pageTitle } from '@/lib/constants';

interface LayoutProps {
  children: ReactNode;
  /** Komt in het tabblad te staan als "Offertes - Resynked" */
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Ook tijdens het laden en het doorsturen staat de titel er al, anders
  // ziet de bezoeker het adres van de pagina in zijn tabblad staan
  const head = (
    <Head>
      <title>{pageTitle(title)}</title>
    </Head>
  );

  if (status === 'loading') {
    return (
      <div className="layout">
        {head}
        <Sidebar />
        <main className="main">
          <div className="content">
            <div className="header">
              <Skeleton height="2rem" width="200px" />
            </div>
            <div className="block" style={{ padding: '2rem' }}>
              <Skeleton height="1rem" width="100%" style={{ marginBottom: '1rem' }} />
              <Skeleton height="1rem" width="100%" style={{ marginBottom: '1rem' }} />
              <Skeleton height="1rem" width="80%" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return head;
  }

  return (
    <div className="layout">
      {head}
      <Sidebar />
      <main className="main">
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  );
}
