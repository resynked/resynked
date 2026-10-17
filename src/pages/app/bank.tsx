import HelpButton from '@/components/HelpButton';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Landmark } from 'lucide-react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Select, { SelectOption } from '@/components/Select';
import FileUpload from '@/components/FileUpload';
import Pagination from '@/components/Pagination';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { usePagination } from '@/hooks/usePagination';
import { BANK_CATEGORIES } from '@/lib/constants';
import { formatIban } from '@/lib/payment';
import { formatCurrency, formatDate, getCustomerDisplayName } from '@/lib/utils';
import type { BankAccount, BankTransaction } from '@/lib/supabase';

interface AccountWithBalance extends BankAccount {
  balance: number | null;
}

interface TransactionRow extends BankTransaction {
  invoice: { id: number; invoice_number: string | null } | null;
  expense: { id: number; supplier: string } | null;
}

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Te verwerken' },
  { value: 'all', label: 'Alle transacties' },
];

const categoryLabel = (value: string) => BANK_CATEGORIES.find(c => c.value === value)?.label || value;

/**
 * Bank: de transacties van je zakelijke rekening, uit een afschrift dat je in
 * je bank-app downloadt (of via de bankkoppeling bij Plug-ins). Betalingen
 * van klanten en aan leveranciers worden waar het zeker is vanzelf aan de
 * factuur of kostenpost gekoppeld; de rest koppel je hier zelf, of je deelt
 * hem in, zoals privé of bankkosten. Zo kloppen je jaarcijfers.
 */
export default function Bank() {
  const toast = useToast();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [filter, setFilter] = useState<SelectOption>(FILTER_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const pagination = usePagination(transactions);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Het venster om één transactie te koppelen
  const [linking, setLinking] = useState<TransactionRow | null>(null);
  const [linkOptions, setLinkOptions] = useState<SelectOption[]>([]);
  const [linkValue, setLinkValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (current = filter) => {
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('/api/bank/accounts'),
        fetch(`/api/bank/transactions${current.value === 'open' ? '?open=1' : ''}`),
      ]);
      setAccounts(accountsRes.ok ? await accountsRes.json() : []);
      setTransactions(transactionsRes.ok ? await transactionsRes.json() : []);
    } catch {
      toast.error('Fout', 'De bankgegevens konden niet geladen worden');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Terug van de bank na het koppelen (zie /api/bank/callback): de uitkomst melden en de link opschonen
  useEffect(() => {
    const { connected, imported, error } = router.query;
    if (connected === undefined) return;
    if (connected === '1') toast.success('Gekoppeld', `Je bank is gekoppeld; ${imported || 0} transactie(s) opgehaald`);
    else toast.error('Koppelen mislukt', typeof error === 'string' ? error : 'Probeer het opnieuw');
    router.replace('/app/bank', undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.connected]);

  const [syncing, setSyncing] = useState(false);

  /** Nu ophalen bij de gekoppelde bank, in plaats van te wachten op de ochtend */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/bank/sync', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Opgehaald', data.imported ? `${data.imported} nieuwe transactie(s)` : 'Er waren geen nieuwe transacties');
      load();
    } catch (error: any) {
      toast.error('Ophalen mislukt', error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const response = await fetch('/api/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: await file.text() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setImportOpen(false);
      toast.success(
        'Ingelezen',
        data.imported
          ? `${data.imported} nieuwe transactie(s)${data.matched ? `, waarvan ${data.matched} vanzelf gekoppeld` : ''}`
          : 'Alle transacties uit dit afschrift stonden er al'
      );
      load();
    } catch (error: any) {
      toast.error('Inlezen mislukt', error.message || 'Probeer het opnieuw');
    } finally {
      setImporting(false);
    }
  };

  /** Opent het koppelvenster met wat er openstaat: facturen bij geld binnen, kosten bij geld af */
  const openLink = async (transaction: TransactionRow) => {
    setLinking(transaction);
    setLinkValue(
      transaction.invoice_id
        ? `invoice:${transaction.invoice_id}`
        : transaction.expense_id
          ? `expense:${transaction.expense_id}`
          : transaction.category
            ? `category:${transaction.category}`
            : ''
    );

    const amount = Math.abs(Number(transaction.amount));
    const categories = BANK_CATEGORIES.map(c => ({ value: `category:${c.value}`, label: c.label }));

    try {
      if (Number(transaction.amount) > 0) {
        const invoices: any[] = await fetch('/api/invoices').then(res => (res.ok ? res.json() : []));
        const options = invoices
          .filter(i => i.status === 'sent' || i.id === transaction.invoice_id)
          // Hetzelfde bedrag bovenaan
          .sort((a, b) => Number(Number(b.total) === amount) - Number(Number(a.total) === amount))
          .map(i => ({
            value: `invoice:${i.id}`,
            label: `Factuur ${i.invoice_number || ''} · ${i.customer ? getCustomerDisplayName(i.customer) : ''} · ${formatCurrency(i.total)}`,
          }));
        setLinkOptions([...options, ...categories]);
      } else {
        const expenses: any[] = await fetch('/api/expenses').then(res => (res.ok ? res.json() : []));
        const options = expenses
          .filter(e => e.status === 'open' || e.id === transaction.expense_id)
          .sort((a, b) => Number(Number(b.total) === amount) - Number(Number(a.total) === amount))
          .map(e => ({
            value: `expense:${e.id}`,
            label: `Kosten · ${e.supplier} · ${formatDate(e.expense_date)} · ${formatCurrency(e.total)}`,
          }));
        setLinkOptions([...options, ...categories]);
      }
    } catch {
      setLinkOptions(categories);
    }
  };

  const saveLink = async (value: string) => {
    if (!linking) return;
    setSaving(true);
    const [kind, id] = value.split(':');
    const body = kind === 'invoice' ? { invoiceId: id } : kind === 'expense' ? { expenseId: id } : kind === 'category' ? { category: id } : {};

    try {
      const response = await fetch(`/api/bank/transactions/${linking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLinking(null);
      toast.success('Gelukt', value ? 'De transactie is gekoppeld' : 'De koppeling is weggehaald');
      load();
    } catch (error: any) {
      toast.error('Fout', error.message || 'Koppelen mislukt');
    } finally {
      setSaving(false);
    }
  };

  const openCount = transactions.filter(t => !t.invoice_id && !t.expense_id && !t.category).length;

  const linkedTo = (transaction: TransactionRow) => {
    if (transaction.invoice) {
      return <Link href={`/app/invoices/${transaction.invoice.id}`}>Factuur {transaction.invoice.invoice_number}</Link>;
    }
    if (transaction.expense) {
      return <Link href={`/app/expenses/${transaction.expense.id}`}>Kosten · {transaction.expense.supplier}</Link>;
    }
    if (transaction.category) return categoryLabel(transaction.category);
    return <span className="status-badge status-draft">Te verwerken</span>;
  };

  if (isLoading) {
    return (
      <Layout title="Bank">
        <div className="header">
          <h1>Bank <HelpButton topic="bank" /></h1>
        </div>
        <Skeleton height="300px" />
      </Layout>
    );
  }

  return (
    <Layout title="Bank">
      <div className="header">
        <h1>Bank <HelpButton topic="bank" /></h1>
        <div className="actions">
          {accounts?.some(a => a.external_id) && (
            <button type="button" className="button cancel" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Ophalen...' : 'Nu ophalen'}
            </button>
          )}
          <button type="button" className="button" onClick={() => setImportOpen(true)}>
            Afschrift importeren
          </button>
        </div>
      </div>

      {accounts && accounts.length === 0 ? (
        <div className="empty-state">
          <Landmark size={22} />
          <h2>Nog geen bankrekening</h2>
          <p>
            Download in je bank-app een afschrift als CAMT.053 (XML) of MT940 en importeer het hier, of koppel je
            bank bij Instellingen &gt; Plug-ins. Betalingen van klanten worden dan vanzelf aan hun factuur gekoppeld.
          </p>
        </div>
      ) : (
        <>
          <div className="grid four">
            {(accounts || []).map((account) => (
              <div key={account.id} className="block stat">
                <span className="label">{account.name || 'Zakelijke rekening'}</span>
                <div className="value">{account.balance === null ? '–' : formatCurrency(account.balance)}</div>
                <div className="note">
                  {formatIban(account.iban)}
                  {account.last_synced_at ? ` · bijgewerkt ${formatDate(account.last_synced_at)}` : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="grid">
            <div className="block">
              <div className="header">
                <h2>
                  Transacties {filter.value === 'open' && <span className="count">{openCount}</span>}
                </h2>
                <Select
                  options={FILTER_OPTIONS}
                  value={filter}
                  onChange={(option) => {
                    if (!option) return;
                    setFilter(option);
                    load(option);
                  }}
                />
              </div>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <h3>{filter.value === 'open' ? 'Alles is verwerkt' : 'Nog geen transacties'}</h3>
                  <p>
                    {filter.value === 'open'
                      ? 'Elke transactie hoort bij een factuur, kostenpost of categorie.'
                      : 'Importeer een afschrift om je transacties te zien.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table headers={['Datum', 'Tegenpartij', 'Bedrag', 'Hoort bij', '']}>
                    {pagination.pageItems.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{formatDate(transaction.booked_on)}</td>
                        <td className="note-cell">
                          <span className="title">{transaction.counterparty_name || transaction.description || '-'}</span>
                          {transaction.counterparty_name && transaction.description && (
                            <span className="title placeholder">{transaction.description}</span>
                          )}
                        </td>
                        <td>{formatCurrency(Number(transaction.amount))}</td>
                        <td>{linkedTo(transaction)}</td>
                        <td className="actions">
                          <button type="button" className="button cancel" onClick={() => openLink(transaction)}>
                            {transaction.invoice_id || transaction.expense_id || transaction.category ? 'Wijzigen' : 'Koppelen'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    pageSize={pagination.pageSize}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}

      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Afschrift importeren">
        <p className="field-note">
          Download in je bank-app of internetbankieren een afschrift van je zakelijke rekening als CAMT.053 (XML) of
          MT940. Bij ING, Rabobank, ABN AMRO, bunq en Knab staat dat bij Downloaden of Exporteren. Een afschrift dat
          al eerder is ingelezen kan geen kwaad: dubbele transacties worden overgeslagen.
        </p>
        <div className="form-section">
          <FileUpload
            value=""
            accept=".xml,.sta,.940,.mt940,.txt,.swi"
            maxBytes={3 * 1024 * 1024}
            hint={importing ? 'Wordt ingelezen...' : 'CAMT.053 (.xml) of MT940 (.sta, .940, .txt)'}
            disabled={importing}
            onSelect={handleImport}
            onRemove={() => {}}
          />
        </div>
      </Modal>

      <Modal isOpen={!!linking} onClose={() => setLinking(null)} title="Transactie koppelen">
        {linking && (
          <>
            <p className="field-note">
              {formatDate(linking.booked_on)} · {formatCurrency(Number(linking.amount))} ·{' '}
              {linking.counterparty_name || '-'}
              {linking.description ? ` · ${linking.description}` : ''}
            </p>
            <div className="form-section">
              <div className="form-group">
                <label>Hoort bij</label>
                <Select
                  value={linkOptions.find(o => o.value === linkValue) || null}
                  onChange={(option) => setLinkValue(option?.value || '')}
                  options={linkOptions}
                  placeholder={Number(linking.amount) > 0 ? 'Kies een factuur of categorie' : 'Kies een kostenpost of categorie'}
                />
              </div>
            </div>
            <div className="buttons">
              {(linking.invoice_id || linking.expense_id || linking.category) && (
                <button type="button" className="button cancel" onClick={() => saveLink('')} disabled={saving}>
                  Ontkoppelen
                </button>
              )}
              <button type="button" className="button" onClick={() => saveLink(linkValue)} disabled={saving || !linkValue}>
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
