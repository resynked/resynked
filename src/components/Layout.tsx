import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { Skeleton } from './Skeleton';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="layout">
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
    return null;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  );
}
