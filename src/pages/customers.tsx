import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';
import type { Customer } from '@/lib/supabase';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleSelectAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map(c => c.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Weet je zeker dat je ${selectedIds.length} klant(en) wilt verwijderen?`)) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/customers/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customers:', error);
    }
  };

  const handleDuplicate = async (customer: Customer) => {
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${customer.name} (kopie)`,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        }),
      });
      fetchCustomers();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating customer:', error);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Klanten</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/customers/new" className="button">
            Klant toevoegen
          </Link>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <h2>Geen klanten</h2>
          <p>Je hebt nog geen klanten toegevoegd. Begin met het toevoegen van je eerste klant.</p>
        </div>
      ) : (
        <Table
          headers={[
            <button
              key="select-all"
              type="button"
              role="checkbox"
              className="checkbox"
              aria-checked={
                selectedIds.length === customers.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === customers.length
                  ? "checked"
                  : selectedIds.length === 0
                    ? "unchecked"
                    : "indeterminate"
              }
              aria-label="Select all rows"
              onClick={handleSelectAll}
            >
              {(selectedIds.length > 0) && <Check size={14} />}
            </button>,
            'Naam',
            'Email',
            'Telefoon',
            'Adres',
            ''
          ]}
        >
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className={selectedIds.includes(customer.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(customer.id)}
                  aria-label={`Select row ${customer.name}`}
                  onClick={() => handleSelectOne(customer.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(customer.id) && <Check size={14} />}
                </button>
              </td>
              <td>{customer.name}</td>
              <td>{customer.email || '-'}</td>
              <td>{customer.phone || '-'}</td>
              <td>{customer.address || '-'}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === customer.id ? dropdownRef : null}>
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === customer.id ? null : customer.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === customer.id && (
                    <div className="action-menu">
                      <Link href={`/customers/${customer.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link href="" className="copy" onClick={() => handleDuplicate(customer)}>
                        Kopiëren
                      </Link>
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(customer.id);
                        }}
                      >
                        Verwijderen
                      </Link>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Layout>
  );
}
