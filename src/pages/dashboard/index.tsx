import { useSession } from 'next-auth/react';
import Layout from '@/components/admin/Layout';

export default function Dashboard() {
  const { data: session } = useSession();

  return (
    <Layout>
      <div className="dashboard-page">
        <h1>Welkom bij Resynked CRM!</h1>
        {session?.user && (
          <p>Ingelogd als: {(session.user as any).email}</p>
        )}
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>Klanten</h3>
            <p>Beheer uw klanten</p>
          </div>
          <div className="stat-card">
            <h3>Producten</h3>
            <p>Beheer uw producten</p>
          </div>
          <div className="stat-card">
            <h3>Facturen</h3>
            <p>Beheer uw facturen</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}