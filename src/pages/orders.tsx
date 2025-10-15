import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Link from 'next/link';
import { Ellipsis, Check } from 'lucide-react';

interface Order {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; email: string | null };
  order_number: string;
  order_date: string;
  total: number;
  status: string;
  created_at: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrders();
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

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze orderbevestiging wilt verwijderen?')) return;

    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
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
    if (!confirm(`Weet je zeker dat je ${selectedIds.length} orderbevestiging(en) wilt verwijderen?`)) return;

    try {
      await Promise.all(
        selectedIds.map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      fetchOrders();
    } catch (error) {
      console.error('Error deleting orders:', error);
    }
  };

  const handleDuplicate = async (order: Order) => {
    try {
      // Fetch full order details with items
      const response = await fetch(`/api/orders/${order.id}`);
      const fullOrder = await response.json();

      // Create new order with same data
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: fullOrder.customer_id,
          order_number: `${fullOrder.order_number}-kopie`,
          order_date: new Date().toISOString().split('T')[0],
          currency: fullOrder.currency,
          tax_percentage: fullOrder.tax_percentage,
          discount_percentage: fullOrder.discount_percentage,
          notes: fullOrder.notes,
          items: fullOrder.order_items?.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })) || [],
        }),
      });
      fetchOrders();
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error duplicating order:', error);
    }
  };

  const handleConvertToInvoice = async (orderId: string) => {
    if (!confirm('Weet je zeker dat je deze orderbevestiging wilt omzetten naar een factuur?')) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/convert-to-invoice`, {
        method: 'POST',
      });
      const invoice = await response.json();

      // Refresh the orders list to show updated status
      fetchOrders();

      // Optionally redirect to the new invoice
      window.location.href = `/invoices/${invoice.id}`;
    } catch (error) {
      console.error('Error converting order to invoice:', error);
      alert('Er ging iets mis bij het omzetten van de orderbevestiging.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'status-draft',
      processing: 'status-sent',
      completed: 'status-paid',
      cancelled: 'status-cancelled',
    };
    return <span className={`status-badge ${statusClasses[status as keyof typeof statusClasses]}`}>{status}</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Orderbevestigingen</h1>
        <div className="actions">
          {selectedIds.length > 0 && (
            <>
              <span className="selected-count">{selectedIds.length} geselecteerd</span>
              <button onClick={handleBulkDelete} className="button negative">
                Verwijder
              </button>
            </>
          )}
          <Link href="/orders/new" className="button">
            Orderbevestiging maken
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <h2>Geen orderbevestigingen</h2>
          <p>Je hebt nog geen orderbevestigingen aangemaakt. Begin met het maken van je eerste orderbevestiging.</p>
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
                selectedIds.length === orders.length
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "mixed"
              }
              data-state={
                selectedIds.length === orders.length
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
            'Orderbevestiging #',
            'Klant',
            'Totaal',
            'Status',
            'Datum',
            ''
          ]}
        >
          {orders.map((order) => (
            <tr
              key={order.id}
              className={selectedIds.includes(order.id) ? 'selected' : ''}
            >
              <td>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(order.id)}
                  aria-label={`Select row ${order.id}`}
                  onClick={() => handleSelectOne(order.id)}
                  className="checkbox"
                >
                  {selectedIds.includes(order.id) && <Check size={14} />}
                </button>
              </td>
              <td>{order.order_number}</td>
              <td>{order.customer.name}</td>
              <td>€{order.total.toFixed(2)}</td>
              <td>{getStatusBadge(order.status)}</td>
              <td>{new Date(order.order_date).toLocaleDateString('nl-NL')}</td>
              <td className="actions">
                <div className="action-dropdown" ref={openDropdownId === order.id ? dropdownRef : null}>
                  <button
                    className="action-trigger"
                    onClick={() => setOpenDropdownId(openDropdownId === order.id ? null : order.id)}
                  >
                    <Ellipsis size={18} />
                  </button>
                  {openDropdownId === order.id && (
                    <div className="action-menu">
                      <Link href={`/orders/${order.id}`} className="edit">
                        Bewerken
                      </Link>
                      <Link href="" className="copy" onClick={() => handleDuplicate(order)}>
                        Kopiëren
                      </Link>
                      {order.status === 'pending' || order.status === 'processing' ? (
                        <Link
                          href=""
                          className="edit"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenDropdownId(null);
                            handleConvertToInvoice(order.id);
                          }}
                        >
                          Omzetten naar factuur
                        </Link>
                      ) : null}
                      <Link
                        href=""
                        className="delete"
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDelete(order.id);
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
