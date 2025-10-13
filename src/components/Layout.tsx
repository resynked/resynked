import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return <div className="loading">Laden...</div>;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}
