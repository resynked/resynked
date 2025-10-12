import { useState, useEffect } from 'react';
import Layout from '@/components/admin/Layout';
import Table from '@/components/admin/Table';
import Link from 'next/link';
import { Pencil, Trash } from 'lucide-react';

interface Invoice {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; email: string | null };
  total: number;
  status: string;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;

    try {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'status-draft',
      sent: 'status-sent',
      paid: 'status-paid',
      cancelled: 'status-cancelled',
    };
    return <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>{status}</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Facturen</h1>
        <Link href="/dashboard/invoices/new" className="button">
          Factuur maken
        </Link>
      </div>

      <Table headers={['Factuur #', 'Klant', 'Totaal', 'Status', 'Datum', '']}>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>#{invoice.id.slice(0, 8)}</td>
            <td>{invoice.customer.name}</td>
            <td>€{invoice.total.toFixed(2)}</td>
            <td>{getStatusBadge(invoice.status)}</td>
            <td>{new Date(invoice.created_at).toLocaleDateString('nl-NL')}</td>
            <td className="actions">
              <Link href={`/dashboard/invoices/${invoice.id}`} className="edit">
                <Pencil size={15} />
              </Link>
              <button className="delete" onClick={() => handleDelete(invoice.id)}>
                <Trash size={15} />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </Layout>
  );
}
