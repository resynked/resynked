import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import DashboardContent, { type DashboardInvoice, type DashboardQuote } from '@/components/DashboardContent';

export default function Dashboard() {
  const { status } = useSession();
  const [quotes, setQuotes] = useState<DashboardQuote[]>([]);
  const [invoices, setInvoices] = useState<DashboardInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDocuments();
    }
  }, [status]);

  const fetchDocuments = async () => {
    try {
      const [quotesRes, invoicesRes] = await Promise.all([
        fetch('/api/quotes'),
        fetch('/api/invoices'),
      ]);

      const quotesData = await quotesRes.json();
      const invoicesData = await invoicesRes.json();

      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Dashboard">
      <DashboardContent quotes={quotes} invoices={invoices} isLoading={isLoading} />
    </Layout>
  );
}
