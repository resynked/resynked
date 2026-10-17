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
import type { VatInvoice, VatRate } from '@/lib/db';

interface Overview {
  rates: VatRate[];
  invoices: VatInvoice[];
}

/** De rubriek op de btw-aangifte bij een tarief */
function rubric(rate: number): string {
  if (rate === 21) return '1a';
  if (rate === 9) return '1b';
  if (rate === 0) return '1e';
  return '1c';
}

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
 * Btw-overzicht: per tarief de omzet en de btw over een kwartaal of jaar, met
 * de rubriek op de aangifte erbij, en de facturen waar het uit komt. De export
 * is een CSV voor de boekhouder of om zelf in Excel te openen.
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
  const totalBase = rates.reduce((sum, r) => sum + r.base, 0);
  const totalVat = rates.reduce((sum, r) => sum + r.vat, 0);

  const handleExport = () => {
    // Een kolom per tarief, zodat de boekhouder per rubriek kan optellen
    const rateColumns = rates.map(r => r.rate);
    const header = [
      'Factuurnummer', 'Factuurdatum', 'Klant', 'Btw-nummer klant',
      ...rateColumns.flatMap(rate => [`Omzet ${rate}%`, `Btw ${rate}%`]),
      'Totaal excl. btw', 'Btw', 'Totaal incl. btw', 'Status', 'Betaald op',
    ];
    const rows = invoices.map(invoice => [
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
      isCreditNote(invoice) ? 'Creditfactuur' : INVOICE_STATUS[invoice.status]?.label || invoice.status,
      formatDate(invoice.paid_at),
    ]);

    // Met BOM, anders toont Excel de é en ë verkeerd
    const csv = '﻿' + [header, ...rows].map(row => row.map(csvField).join(';')).join('\r\n');
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
        <h1>Btw-overzicht</h1>
        <div className="actions">
          <button type="button" className="button" onClick={handleExport} disabled={isLoading || invoices.length === 0}>
            Exporteren
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="block">
          <div className="header">
            <h2>Per tarief</h2>
            <Select options={options} value={period} onChange={(option) => option && setPeriod(option)} />
          </div>

          {isLoading ? (
            <Skeleton height="150px" />
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <h3>Geen facturen in deze periode</h3>
              <p>Zodra je een factuur verstuurt of als betaald markeert, telt hij hier mee op zijn factuurdatum.</p>
            </div>
          ) : (
            <>
              <Table headers={['Rubriek', 'Tarief', 'Omzet excl. btw', 'Btw']}>
                {rates.map((rate) => (
                  <tr key={rate.rate}>
                    <td>{rubric(rate.rate)}</td>
                    <td>{rate.rate}%</td>
                    <td>{formatCurrency(rate.base)}</td>
                    <td>{formatCurrency(rate.vat)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Totaal</strong>
                  </td>
                  <td />
                  <td>
                    <strong>{formatCurrency(totalBase)}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(totalVat)}</strong>
                  </td>
                </tr>
              </Table>
              <p className="field-note">
                Op factuurdatum, zoals bij de btw-aangifte. Verstuurde en betaalde facturen tellen mee, creditfacturen
                als min-bedrag; concepten niet. Bij btw verlegd of levering buiten Nederland kan de rubriek afwijken;
                kijk dat na met je boekhouder.
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
                    <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
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
    </Layout>
  );
}
