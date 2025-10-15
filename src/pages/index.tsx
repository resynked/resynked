import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ChatAssistant from '@/components/ChatAssistant';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState({ customers: 0, products: 0, invoices: 0 });

  useEffect(() => {
    // Only fetch stats if authenticated
    if (status === 'authenticated') {
      fetchStats();
    }
  }, [status]);

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
      <div className="grid">
        <div className="block chat">
          <ChatAssistant />
        </div>
        <div className="block">
            <h2>Omzet</h2>
        </div>
      </div>
    </Layout>
  );
}