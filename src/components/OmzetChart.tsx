import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Select, { SelectOption } from './Select';

interface RevenueData {
  date: string;
  revenue: number;
}

const periodOptions: SelectOption[] = [
  { value: 'today', label: 'Vandaag' },
  { value: 'week', label: 'Deze week' },
  { value: 'month', label: 'Deze maand' },
  { value: 'year', label: 'Dit jaar' },
];

export default function OmzetChart() {
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
      setData(data);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space20)' }}>
        <h2 style={{ margin: 0 }}>Omzet</h2>
        <div style={{ width: '180px' }}>
          <Select
            options={periodOptions}
            value={selectedPeriod}
            onChange={handlePeriodChange}
          />
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space20)' }}>
        <div style={{ fontSize: 'var(--h4-size)', fontWeight: 600, color: 'var(--color5)' }}>
          €{totalRevenue.toFixed(2)}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--font-color2)' }}>
          Totale omzet uit betaalde facturen
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div style={{ color: 'var(--font-color2)' }}>Laden...</div>
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div style={{ textAlign: 'center', color: 'var(--font-color2)' }}>
            <p>Geen omzetgegevens beschikbaar</p>
            <p style={{ fontSize: '13px' }}>Er zijn geen betaalde facturen in deze periode</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--font-color2)', fontSize: 12 }}
              tickLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis
              tick={{ fill: 'var(--font-color2)', fontSize: 12 }}
              tickLine={{ stroke: 'var(--border-color)' }}
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color2)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius1)',
                fontSize: '13px',
              }}
              formatter={(value: number) => [`€${value.toFixed(2)}`, 'Omzet']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color5)"
              strokeWidth={2}
              dot={{ fill: 'var(--color5)', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
