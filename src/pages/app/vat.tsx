import HelpButton from '@/components/HelpButton';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Select, { SelectOption } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { INVOICE_STATUS } from '@/lib/constants';
import { isCreditNote } from '@/lib/invoices';
import { formatCurrency, formatDate, getCustomerDisplayName } from '@/lib/utils';
import { categoryLabel } from '@/lib/expenses';
import type { VatExpense, VatInvoice, VatRate } from '@/lib/db';

interface Overview {
  rates: VatRate[];
  invoices: VatInvoice[];
  expenses: VatExpense[];
  inputVat: number;
}

/** De rubrieken voor omzet op de btw-aangifte, met welk tarief erin valt */
const SALES_RUBRICS = [
  { code: '1a', label: 'Leveringen/diensten belast met hoog tarief', matches: (rate: number) => rate === 21 },
  { code: '1b', label: 'Leveringen/diensten belast met laag tarief', matches: (rate: number) => rate === 9 },
  { code: '1c', label: 'Leveringen/diensten belast met overige tarieven', matches: (rate: number) => ![0, 9, 21].includes(rate) },
  { code: '1e', label: 'Leveringen/diensten belast met 0% of niet bij u belast', matches: (rate: number) => rate === 0 },
];

const pad = (value: number) => String(value).padStart(2, '0');

/** Kwartalen van dit en vorig jaar, nieuwste eerst, en beide jaren in zijn geheel */
function periodOptions(): SelectOption[] {
  const now = new Date();
  const year = now.getFullYear();
  const current = Math.floor(now.getMonth() / 3) + 1;
  const options: SelectOption[] = [];

  for (let y = year; y >= year - 1; y--) {
    for (let q = y === year ? current : 4; q >= 1; q--) {
      const lastMonth = q * 3;
      const lastDay = new Date(y, lastMonth, 0).getDate();
      options.push({ value: `${y}-${pad(lastMonth - 2)}-01|${y}-${pad(lastMonth)}-${pad(lastDay)}`, label: `Q${q} ${y}` });
    }
  }
  options.push({ value: `${year}-01-01|${year}-12-31`, label: `Heel ${year}` });
  options.push({ value: `${year - 1}-01-01|${year - 1}-12-31`, label: `Heel ${year - 1}` });

  return options;
}

/** Een bedrag zoals Excel het in Nederland leest: komma als decimaalteken, geen euroteken */
const csvAmount = (amount: number) => amount.toFixed(2).replace('.', ',');

/** Een veld in de CSV; puntkomma's en aanhalingstekens tussen aanhalingstekens */
const csvField = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * Btw-overzicht: de btw-aangifte over een kwartaal of jaar, rubriek voor
 * rubriek zoals in Mijn Belastingdienst Zakelijk: omzet en btw per tarief,
 * de voorbelasting uit de kosten, en wat je moet betalen of terugkrijgt.
 * Daaronder de facturen en kosten waar het uit komt. De export is een CSV
 * voor de boekhouder of om zelf in Excel te openen.
 */
export default function Vat() {
  const toast = useToast();
  const [options] = useState(periodOptions);
  // Standaard het vorige kwartaal: daar doe je nu aangifte over
  const [period, setPeriod] = useState<SelectOption>(options[1] || options[0]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const [from, to] = String(period.value).split('|');
    setIsLoading(true);
    fetch(`/api/vat?from=${from}&to=${to}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setOverview(data);
      })
      .catch((error) => toast.error('Fout', error.message || 'Het btw-overzicht kon niet geladen worden'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const rates = overview?.rates || [];
  const invoices = overview?.invoices || [];
  const expenses = overview?.expenses || [];
  const inputVat = overview?.inputVat || 0;
  const totalVat = rates.reduce((sum, r) => sum + r.vat, 0);
  const balance = Math.round((totalVat - inputVat) * 100) / 100;
  const isEmpty = invoices.length === 0 && expenses.length === 0;

  // Per rubriek de omzet en de btw; een rubriek zonder iets erin blijft 0
  const salesRows = SALES_RUBRICS.map((rubric) => {
    const matching = rates.filter(r => rubric.matches(r.rate));
    return {
      ...rubric,
      base: matching.reduce((sum, r) => sum + r.base, 0),
      vat: matching.reduce((sum, r) => sum + r.vat, 0),
    };
  });

  const handleExport = () => {
    // Een kolom per tarief, zodat de boekhouder per rubriek kan optellen
    const rateColumns = rates.map(r => r.rate);
    const header = [
      'Soort', 'Nummer', 'Datum', 'Relatie', 'Btw-nummer',
      ...rateColumns.flatMap(rate => [`Omzet ${rate}%`, `Btw ${rate}%`]),
      'Totaal excl. btw', 'Btw', 'Totaal incl. btw', 'Status', 'Betaald op',
    ];
    const rows = invoices.map(invoice => [
      isCreditNote(invoice) ? 'Creditfactuur' : 'Verkoop',
      invoice.invoice_number || '',
      formatDate(invoice.invoice_date),
      invoice.customer ? getCustomerDisplayName(invoice.customer) : '',
      invoice.customer?.btw_number || '',
      ...rateColumns.flatMap(rate => {
        const part = invoice.rates.find(r => r.rate === rate);
        return [csvAmount(part?.base || 0), csvAmount(part?.vat || 0)];
      }),
      csvAmount(invoice.base),
      csvAmount(invoice.vat),
      csvAmount(invoice.total),
      INVOICE_STATUS[invoice.status]?.label || invoice.status,
      formatDate(invoice.paid_at),
    ]);

    // De kosten eronder; de btw daarvan is voorbelasting, behalve bij eten en drinken
    const expenseRows = expenses.map(expense => [
      `Inkoop: ${categoryLabel(expense.category)}`,
      expense.reference || '',
      formatDate(expense.expense_date),
      expense.supplier,
      '',
      ...rateColumns.flatMap(() => ['', '']),
      csvAmount(expense.total_excl),
      csvAmount(expense.deductible),
      csvAmount(expense.total),
      expense.status === 'paid' ? 'Betaald' : 'Open',
      formatDate(expense.paid_at),
    ]);

    // Met BOM, anders toont Excel de é en ë verkeerd
    const csv = '\uFEFF' + [header, ...rows, ...expenseRows].map(row => row.map(csvField).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Btw-overzicht ${period.label}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Btw-overzicht">
      <div className="header">
        <h1>Btw-overzicht <HelpButton topic="vat" /></h1>
        <div className="actions">
          <button type="button" className="button" onClick={handleExport} disabled={isLoading || isEmpty}>
            Exporteren
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="block">
          <div className="header">
            <h2>Aangifte</h2>
            <Select options={options} value={period} onChange={(option) => option && setPeriod(option)} />
          </div>

          {isLoading ? (
            <Skeleton height="150px" />
          ) : isEmpty ? (
            <div className="empty-state">
              <h3>Geen facturen of kosten in deze periode</h3>
              <p>Een verstuurde factuur telt mee op zijn factuurdatum, een kostenpost op de datum van de bon.</p>
            </div>
          ) : (
            <>
              <Table headers={['Rubriek', 'Omschrijving', 'Omzet', 'Btw']}>
                {salesRows.map((row) => (
                  <tr key={row.code}>
                    <td>{row.code}</td>
                    <td>{row.label}</td>
                    <td>{formatCurrency(row.base)}</td>
                    <td>{row.code === '1e' ? '' : formatCurrency(row.vat)}</td>
                  </tr>
                ))}
                <tr>
                  <td>5a</td>
                  <td>Verschuldigde btw</td>
                  <td />
                  <td>{formatCurrency(totalVat)}</td>
                </tr>
                <tr>
                  <td>5b</td>
                  <td>Voorbelasting</td>
                  <td />
                  <td>{formatCurrency(inputVat)}</td>
                </tr>
                <tr>
                  <td />
                  <td>
                    <strong>{balance >= 0 ? 'Te betalen' : 'Terug te vragen'}</strong>
                  </td>
                  <td />
                  <td>
                    <strong>{formatCurrency(Math.abs(balance))}</strong>
                  </td>
                </tr>
              </Table>
              <p className="field-note">
                Neem deze bedragen over in Mijn Belastingdienst Zakelijk; de Belastingdienst rondt af op hele euro's.
                Omzet telt op factuurdatum (verstuurd en betaald, creditfacturen als min-bedrag, geen concepten), kosten
                op de datum van de bon. Bij btw verlegd, of leveringen naar of uit het buitenland, horen bedragen in
                andere rubrieken; kijk dat na met je boekhouder.
              </p>
            </>
          )}
        </div>
      </div>

      {!isLoading && invoices.length > 0 && (
        <div className="grid">
          <div className="block">
            <div className="header">
              <h2>
                Facturen <span className="count">{invoices.length}</span>
              </h2>
            </div>
            <Table headers={['Factuur #', 'Factuurdatum', 'Klant', 'Excl. btw', 'Btw', 'Totaal', 'Status']}>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/app/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                    {isCreditNote(invoice) && <span className="placeholder"> · Credit</span>}
                  </td>
                  <td>{formatDate(invoice.invoice_date)}</td>
                  <td>{invoice.customer ? getCustomerDisplayName(invoice.customer) : '-'}</td>
                  <td>{formatCurrency(invoice.base)}</td>
                  <td>{formatCurrency(invoice.vat)}</td>
                  <td>{formatCurrency(invoice.total)}</td>
                  <td>
                    <span className={`status-badge ${INVOICE_STATUS[invoice.status]?.className || ''}`}>
                      {INVOICE_STATUS[invoice.status]?.label || invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      {!isLoading && expenses.length > 0 && (
        <div className="grid">
          <div className="block">
            <div className="header">
              <h2>
                Kosten <span className="count">{expenses.length}</span>
              </h2>
            </div>
            <Table headers={['Leverancier', 'Datum', 'Categorie', 'Excl. btw', 'Btw', 'Voorbelasting', 'Totaal']}>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <Link href={`/app/expenses/${expense.id}`}>{expense.supplier}</Link>
                  </td>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td>{categoryLabel(expense.category)}</td>
                  <td>{formatCurrency(expense.total_excl)}</td>
                  <td>{formatCurrency(expense.vat_amount)}</td>
                  <td>{formatCurrency(expense.deductible)}</td>
                  <td>{formatCurrency(expense.total)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </Layout>
  );
}
