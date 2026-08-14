import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import OmzetChart from '@/components/OmzetChart';
import { formatCurrency, formatDate, getCustomerDisplayName } from '@/lib/utils';
import type { Customer } from '@/lib/supabase';

interface Document {
  id: string;
  customer: Pick<Customer, 'name' | 'first_name' | 'middle_name' | 'last_name' | 'company_name'> | null;
  total: number;
  status: string;
}

interface OpenQuote extends Document {
  quote_number: string;
  valid_until: string;
}

interface OpenInvoice extends Document {
  invoice_number: string | null;
  due_date: string | null;
}

export default function Dashboard() {
  const { status } = useSession();
  const [quotes, setQuotes] = useState<OpenQuote[]>([]);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);

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

      setQuotes(
        (quotesData || []).filter((q: OpenQuote) => q.status === 'draft' || q.status === 'sent')
      );
      setInvoices(
        (invoicesData || []).filter((i: OpenInvoice) => i.status === 'draft' || i.status === 'sent')
      );
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const customerName = (document: Document) =>
    document.customer ? getCustomerDisplayName(document.customer) : '';

  return (
    <Layout>
      <div className="grid">
        <div className="block">
          <OmzetChart />
        </div>
      </div>

      <div className="grid two">
        <div className="block">
          <h2>Openstaande offertes</h2>
          {quotes.length === 0 ? (
            <p>Geen openstaande offertes.</p>
          ) : (
            <Table headers={['Offerte #', 'Klant', 'Totaal', 'Geldig tot']}>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link href={`/quotes/${quote.id}`}>{quote.quote_number}</Link>
                  </td>
                  <td>{customerName(quote)}</td>
                  <td>{formatCurrency(quote.total)}</td>
                  <td>{formatDate(quote.valid_until)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="block">
          <h2>Openstaande facturen</h2>
          {invoices.length === 0 ? (
            <p>Geen openstaande facturen.</p>
          ) : (
            <Table headers={['Factuur #', 'Klant', 'Totaal', 'Vervaldatum']}>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`}>
                      {invoice.invoice_number || `#${invoice.id}`}
                    </Link>
                  </td>
                  <td>{customerName(invoice)}</td>
                  <td>{formatCurrency(invoice.total)}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
}
