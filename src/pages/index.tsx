import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ChatAssistant from '@/components/ChatAssistant';

export default function Dashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({ customers: 0, products: 0, invoices: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [customersRes, productsRes, invoicesRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/products'),
        fetch('/api/invoices'),
      ]);

      const customers = await customersRes.json();
      const products = await productsRes.json();
      const invoices = await invoicesRes.json();

      setStats({
        customers: customers.length || 0,
        products: products.length || 0,
        invoices: invoices.length || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <Layout>
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <ChatAssistant />
        </div>
        <div className="dashboard-right">
          <div className="dashboard-section">
            <h2>Omzet</h2>
            <div className="revenue-chart">
              {/* Revenue chart will go here */}
              <p className="coming-soon">Grafiek komt binnenkort</p>
            </div>
          </div>
          <div className="dashboard-section">
            <h2>Laatste openstaande facturen</h2>
            <div className="invoices-list">
              <p className="coming-soon">Factuurlijst komt binnenkort</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}