import { useState, useEffect } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Select, { SelectOption } from './Select';
import { Skeleton } from './Skeleton';
import { formatCurrency } from '@/lib/utils';

interface RevenueData {
  date: string;
  /** Betaalde facturen */
  revenue: number;
  /** Verzonden facturen die nog niet betaald zijn */
  unrealized: number;
}

const periodOptions: SelectOption[] = [
  { value: 'today', label: 'Vandaag' },
  { value: 'week', label: 'Deze week' },
  { value: 'month', label: 'Deze maand' },
  { value: 'year', label: 'Dit jaar' },
];

/** €1.250 als €1,3k, zodat de as smal blijft */
const formatAxis = (value: number) =>
  value >= 1000 ? `€${(value / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : `€${value}`;

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: RevenueData }[];
}

/** De waarden van één dag onder elkaar, met hetzelfde merkje als in de legenda */
function ChartTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <span className="label">{label}</span>
      <span className="row">
        <span className="swatch realized" />
        Gerealiseerd
        <strong>{formatCurrency(point.revenue)}</strong>
      </span>
      <span className="row">
        <span className="swatch unrealized" />
        Ongerealiseerd
        <strong>{formatCurrency(point.unrealized)}</strong>
      </span>
    </div>
  );
}

export default function RevenueChart() {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectOption>(periodOptions[2]); // Default to "Deze maand"

  useEffect(() => {
    fetchRevenueData(selectedPeriod.value);
  }, [selectedPeriod]);

  const fetchRevenueData = async (period: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/revenue?period=${period}`);
      const data = await res.json();
      setData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (option: SelectOption | null) => {
    if (option) {
      setSelectedPeriod(option);
    }
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalUnrealized = data.reduce((sum, item) => sum + item.unrealized, 0);

  return (
    <div className="revenue-chart">
      <div className="header">
        <h2>Omzet</h2>
        <Select options={periodOptions} value={selectedPeriod} onChange={handlePeriodChange} />
      </div>

      {/* De totalen zijn meteen de legenda van de grafiek */}
      <div className="chart-legend">
        <div className="stat">
          <span className="label"><span className="swatch realized" />Gerealiseerd</span>
          <div className="value">{loading ? <Skeleton height="28px" width="120px" /> : formatCurrency(totalRevenue)}</div>
          <span className="note">Betaalde facturen</span>
        </div>
        <div className="stat">
          <span className="label"><span className="swatch unrealized" />Ongerealiseerd</span>
          <div className="value">{loading ? <Skeleton height="28px" width="120px" /> : formatCurrency(totalUnrealized)}</div>
          <span className="note">Verzonden, nog niet betaald</span>
        </div>
      </div>

      {loading ? (
        <Skeleton height="300px" />
      ) : totalRevenue === 0 && totalUnrealized === 0 ? (
        <div className="empty-state">
          <h3>Geen omzet in deze periode</h3>
          <p>Zodra je een factuur verstuurt of als betaald markeert, verschijnt hij hier.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color5)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--color5)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border-color)" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={20}
              tick={{ fill: 'var(--font-color2)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fill: 'var(--font-color2)', fontSize: 12 }}
              tickFormatter={formatAxis}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--font-color2)', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color5)"
              strokeWidth={2}
              fill="url(#revenue-fill)"
              dot={false}
              activeDot={{ r: 5, fill: 'var(--color5)', stroke: 'var(--color2)', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="unrealized"
              stroke="var(--font-color2)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 5, fill: 'var(--font-color2)', stroke: 'var(--color2)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
