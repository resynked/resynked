import { useState, useEffect } from 'react';
import Layout from '@/components/admin/Layout';
import Table from '@/components/admin/Table';
import Link from 'next/link';
import { Pencil, Trash } from 'lucide-react';
import type { Customer } from '@/lib/supabase';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze klant wilt verwijderen?')) return;

    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Klanten</h1>
        <Link href="/customers/new" className="button">
          Klant toevoegen
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <h2>Geen klanten</h2>
          <p>Je hebt nog geen klanten toegevoegd. Begin met het toevoegen van je eerste klant.</p>
        </div>
      ) : (
        <Table headers={['Naam', 'Email', 'Telefoon', 'Adres', '']}>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>{customer.email || '-'}</td>
              <td>{customer.phone || '-'}</td>
              <td>{customer.address || '-'}</td>
              <td className="actions">
                <Link href={`/customers/${customer.id}`} className="edit">
                  <Pencil size={15} />
                </Link>
                <Link href="" className="delete" onClick={() => handleDelete(customer.id)}>
                  <Trash size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Layout>
  );
}
