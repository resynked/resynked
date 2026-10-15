import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import OmzetChart from '@/components/OmzetChart';
import { Skeleton } from '@/components/Skeleton';
import { QUOTE_STATUS } from '@/lib/constants';
import { formatCurrency, formatDate, getCustomerDisplayName } from '@/lib/utils';
import type { Customer } from '@/lib/supabase';

interface Document {
  id: string;
  customer: Pick<Customer, 'name' | 'first_name' | 'middle_name' | 'last_name' | 'company_name'> | null;
  total: number;
  status: string;
}

interface Quote extends Document {
  quote_number: string;
  valid_until: string;
}

interface Invoice extends Document {
  invoice_number: string | null;
  due_date: string | null;
}

/** Zoveel regels per tabel; de rest staat bij Offertes en Facturen */
const TABLE_ROWS = 5;

const sum = (documents: Document[]) => documents.reduce((total, document) => total + (document.total || 0), 0);

/** Een verzonden factuur waarvan de vervaldatum voorbij is */
const isOverdue = (invoice: Invoice) => {
  if (invoice.status !== 'sent' || !invoice.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(invoice.due_date) < today;
};

/** Eerst wat het snelst verloopt; zonder datum achteraan */
const byDate = (date: (document: any) => string | null) => (a: Document, b: Document) =>
  (date(a) || '9999').localeCompare(date(b) || '9999');

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function Dashboard() {
  const { status } = useSession();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  const customerName = (document: Document) =>
    document.customer ? getCustomerDisplayName(document.customer) : '';

  const openQuotes = quotes
    .filter((quote) => quote.status === 'draft' || quote.status === 'sent')
    .sort(byDate((quote: Quote) => quote.valid_until));
  const openInvoices = invoices
    .filter((invoice) => invoice.status === 'draft' || invoice.status === 'sent')
    .sort(byDate((invoice: Invoice) => invoice.due_date));
  const sentInvoices = invoices.filter((invoice) => invoice.status === 'sent');
  const overdueInvoices = sentInvoices.filter(isOverdue);

  // Van de offertes waar een besluit over is: hoeveel zijn er goedgekeurd
  const approved = quotes.filter((quote) => quote.status === 'approved').length;
  const decided = quotes.filter((quote) => ['approved', 'rejected', 'expired'].includes(quote.status)).length;

  const stats = [
    {
      label: 'Te ontvangen',
      value: formatCurrency(sum(sentInvoices)),
      note: plural(sentInvoices.length, 'factuur wacht op betaling', 'facturen wachten op betaling'),
    },
    {
      label: 'Verlopen',
      value: formatCurrency(sum(overdueInvoices)),
      note: overdueInvoices.length
        ? plural(overdueInvoices.length, 'factuur over de vervaldatum', 'facturen over de vervaldatum')
        : 'Alles op tijd betaald',
      className: overdueInvoices.length ? 'negative' : '',
    },
    {
      label: 'Openstaande offertes',
      value: formatCurrency(sum(openQuotes)),
      note: plural(openQuotes.length, 'offerte staat open', 'offertes staan open'),
    },
    {
      label: 'Goedgekeurd',
      value: decided ? `${Math.round((approved / decided) * 100)}%` : '–',
      note: decided ? `${approved} van ${plural(decided, 'offerte', 'offertes')}` : 'Nog geen offertes beoordeeld',
    },
  ];

  return (
    <Layout title="Dashboard">
      <div className="header">
        <h1>Dashboard</h1>
        <div className="actions">
          <Link href="/invoices/new" className="button tertiary">
            Factuur maken
          </Link>
          <Link href="/quotes/new" className="button">
            Offerte maken
          </Link>
        </div>
      </div>

      <div className="grid four">
        {stats.map((stat) => (
          <div key={stat.label} className={`block stat ${stat.className || ''}`}>
            <span className="label">{stat.label}</span>
            <div className="value">{isLoading ? <Skeleton height="28px" width="60%" /> : stat.value}</div>
            <div className="note">{isLoading ? <Skeleton height="12px" width="80%" /> : stat.note}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="block">
          <OmzetChart />
        </div>
      </div>

      <div className="grid two">
        <div className="block">
          <div className="block-header">
            <h2>
              Openstaande offertes <span className="count">{openQuotes.length}</span>
            </h2>
            <Link href="/quotes">Alles bekijken</Link>
          </div>
          {isLoading ? (
            <Skeleton height="150px" />
          ) : openQuotes.length === 0 ? (
            <p className="placeholder">Geen openstaande offertes.</p>
          ) : (
            <Table headers={['Offerte #', 'Klant', 'Status', 'Geldig tot', 'Totaal']}>
              {openQuotes.slice(0, TABLE_ROWS).map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link href={`/quotes/${quote.id}`}>{quote.quote_number}</Link>
                  </td>
                  <td>{customerName(quote)}</td>
                  <td>
                    <span className={`status-badge ${QUOTE_STATUS[quote.status]?.className || ''}`}>
                      {QUOTE_STATUS[quote.status]?.label || quote.status}
                    </span>
                  </td>
                  <td>{formatDate(quote.valid_until)}</td>
                  <td className="amount">{formatCurrency(quote.total)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="block">
          <div className="block-header">
            <h2>
              Openstaande facturen <span className="count">{openInvoices.length}</span>
            </h2>
            <Link href="/invoices">Alles bekijken</Link>
          </div>
          {isLoading ? (
            <Skeleton height="150px" />
          ) : openInvoices.length === 0 ? (
            <p className="placeholder">Geen openstaande facturen.</p>
          ) : (
            <Table headers={['Factuur #', 'Klant', 'Status', 'Vervaldatum', 'Totaal']}>
              {openInvoices.slice(0, TABLE_ROWS).map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`}>
                      {invoice.invoice_number || `#${invoice.id}`}
                    </Link>
                  </td>
                  <td>{customerName(invoice)}</td>
                  <td>
                    {isOverdue(invoice) ? (
                      <span className="status-badge status-cancelled">Verlopen</span>
                    ) : (
                      <span className={`status-badge status-${invoice.status}`}>
                        {invoice.status === 'sent' ? 'Verzonden' : 'Concept'}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td className="amount">{formatCurrency(invoice.total)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
}
