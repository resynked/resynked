import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Table from '@/components/Table';
import Select, { SelectOption } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Line {
  code: string;
  name: string;
  amount: number;
}

interface Figures {
  year: number;
  revenue: Line[];
  costs: Line[];
  totalRevenue: number;
  totalCosts: number;
  result: number;
  assets: Line[];
  liabilities: Line[];
  equity: Line[];
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  journal: { date: string; account: string; description: string; debit: number; credit: number; source: string }[];
}

const thisYear = new Date().getFullYear();
const YEAR_OPTIONS: SelectOption[] = [0, 1, 2, 3, 4].map(i => ({ value: String(thisYear - i), label: String(thisYear - i) }));

const csvAmount = (amount: number) => (amount ? amount.toFixed(2).replace('.', ',') : '');
const csvField = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Rijen van een overzicht, met een vetgedrukte totaalregel eronder */
function Rows({ lines, total, totalLabel }: { lines: Line[]; total: number; totalLabel: string }) {
  return (
    <>
      {lines.map((line) => (
        <tr key={`${line.code}-${line.name}`}>
          <td>{line.code}</td>
          <td>{line.name}</td>
          <td>{formatCurrency(line.amount)}</td>
        </tr>
      ))}
      <tr>
        <td />
        <td>
          <strong>{totalLabel}</strong>
        </td>
        <td>
          <strong>{formatCurrency(total)}</strong>
        </td>
      </tr>
    </>
  );
}

/**
 * Jaarcijfers: de winst-en-verliesrekening en de balans van een jaar,
 * berekend uit je facturen, kosten en bank (zie lib/ledger). De export is het
 * grootboekjournaal van dat jaar, voor de boekhouder en de aangifte
 * inkomstenbelasting.
 */
export default function Reports() {
  const toast = useToast();
  const [year, setYear] = useState<SelectOption>(YEAR_OPTIONS[0]);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/reports?year=${year.value}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setFigures(data);
      })
      .catch((error) => toast.error('Fout', error.message || 'De jaarcijfers konden niet geladen worden'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const handleExport = () => {
    if (!figures) return;
    const header = ['Datum', 'Rekening', 'Omschrijving', 'Bron', 'Debet', 'Credit'];
    const rows = figures.journal.map(line => [
      formatDate(line.date),
      line.account,
      line.description,
      line.source,
      csvAmount(line.debit),
      csvAmount(line.credit),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvField).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Grootboek ${figures.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = figures && figures.journal.length === 0 && figures.assets.length === 0;

  return (
    <Layout title="Jaarcijfers">
      <div className="header">
        <h1>Jaarcijfers</h1>
        <div className="actions">
          <button type="button" className="button" onClick={handleExport} disabled={isLoading || !figures || figures.journal.length === 0}>
            Grootboek exporteren
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="block">
          <div className="header">
            <h2>Winst-en-verliesrekening</h2>
            <Select options={YEAR_OPTIONS} value={year} onChange={(option) => option && setYear(option)} />
          </div>

          {isLoading || !figures ? (
            <Skeleton height="200px" />
          ) : isEmpty ? (
            <div className="empty-state">
              <h3>Nog niets in {figures.year}</h3>
              <p>Zodra je facturen verstuurt, kosten toevoegt of een afschrift importeert, staan de cijfers hier.</p>
            </div>
          ) : (
            <>
              <Table headers={['Rekening', 'Omzet', 'Bedrag']}>
                <Rows lines={figures.revenue} total={figures.totalRevenue} totalLabel="Totaal omzet" />
              </Table>
              <Table headers={['Rekening', 'Kosten', 'Bedrag']}>
                <Rows lines={figures.costs} total={figures.totalCosts} totalLabel="Totaal kosten" />
                <tr>
                  <td />
                  <td>
                    <strong>{figures.result >= 0 ? 'Winst' : 'Verlies'}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(figures.result)}</strong>
                  </td>
                </tr>
              </Table>
            </>
          )}
        </div>
      </div>

      {!isLoading && figures && !isEmpty && (
        <div className="grid two">
          <div className="block">
            <div className="header">
              <h2>Activa per 31-12-{figures.year}</h2>
            </div>
            <Table headers={['Rekening', 'Omschrijving', 'Bedrag']}>
              <Rows lines={figures.assets} total={figures.totalAssets} totalLabel="Totaal activa" />
            </Table>
          </div>
          <div className="block">
            <div className="header">
              <h2>Passiva per 31-12-{figures.year}</h2>
            </div>
            <Table headers={['Rekening', 'Omschrijving', 'Bedrag']}>
              <Rows
                lines={[...figures.equity, ...figures.liabilities]}
                total={figures.totalLiabilitiesAndEquity}
                totalLabel="Totaal passiva"
              />
            </Table>
          </div>
        </div>
      )}

      {!isLoading && figures && !isEmpty && (
        <p className="field-note">
          Berekend uit je facturen, kosten en banktransacties. Staan er nog banktransacties op &quot;te verwerken&quot;,
          koppel die dan eerst bij Bank. Dit is geen officiële jaarrekening: afschrijvingen op investeringen vanaf
          € 450, voorraad en fiscale regelingen zoals de zelfstandigenaftrek zitten er niet in. Laat je boekhouder
          ernaar kijken voor je aangifte inkomstenbelasting.
        </p>
      )}
    </Layout>
  );
}
