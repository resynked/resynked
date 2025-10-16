import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    if (req.method === 'GET') {
      const periodParam = req.query.period;
      const period = typeof periodParam === 'string' ? periodParam : 'month';

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
      }

      // Fetch paid invoices within the date range
      const { data: invoices, error } = await supabaseAdmin
        .from('invoices')
        .select('created_at, total, invoice_date')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group invoices by date and sum the totals
      const revenueByDate = new Map<string, number>();

      invoices.forEach((invoice) => {
        const date = new Date(invoice.created_at);
        let dateKey: string;

        if (period === 'today') {
          // Group by hour
          dateKey = `${date.getHours()}:00`;
        } else if (period === 'week' || period === 'month') {
          // Group by day
          dateKey = date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
        } else {
          // Group by month for year view
          dateKey = date.toLocaleDateString('nl-NL', { month: 'short' });
        }

        revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + invoice.total);
      });

      // Convert to array format for Recharts
      const chartData = Array.from(revenueByDate.entries()).map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100, // Round to 2 decimals
      }));

      // Fill in missing dates with 0 revenue
      const filledData = fillMissingDates(chartData, period, startDate, now);

      return res.status(200).json(filledData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function fillMissingDates(
  data: { date: string; revenue: number }[],
  period: string,
  startDate: Date,
  endDate: Date
): { date: string; revenue: number }[] {
  const result: { date: string; revenue: number }[] = [];
  const dataMap = new Map(data.map(item => [item.date, item.revenue]));

  if (period === 'today') {
    // Fill hours from 0 to current hour
    for (let hour = 0; hour <= endDate.getHours(); hour++) {
      const dateKey = `${hour}:00`;
      result.push({
        date: dateKey,
        revenue: dataMap.get(dateKey) || 0,
      });
    }
  } else if (period === 'week') {
    // Fill last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      const dateKey = date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
      result.push({
        date: dateKey,
        revenue: dataMap.get(dateKey) || 0,
      });
    }
  } else if (period === 'month') {
    // Fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      const dateKey = date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
      result.push({
        date: dateKey,
        revenue: dataMap.get(dateKey) || 0,
      });
    }
  } else if (period === 'year') {
    // Fill last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(endDate);
      date.setMonth(endDate.getMonth() - i);
      const dateKey = date.toLocaleDateString('nl-NL', { month: 'short' });
      result.push({
        date: dateKey,
        revenue: dataMap.get(dateKey) || 0,
      });
    }
  }

  return result;
}
