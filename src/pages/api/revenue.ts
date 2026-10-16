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

      // Betaalde facturen zijn gerealiseerde omzet, op de dag dat ze betaald
      // zijn. Verzonden facturen die nog niet betaald zijn, zijn ongerealiseerde
      // omzet, op de dag dat ze gemaakt zijn
      const since = startDate.toISOString();
      const [paid, open] = await Promise.all([
        supabaseAdmin
          .from('invoices')
          .select('paid_at, total')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid')
          .gte('paid_at', since),
        supabaseAdmin
          .from('invoices')
          .select('created_at, total')
          .eq('tenant_id', tenantId)
          .eq('status', 'sent')
          .gte('created_at', since),
      ]);

      if (paid.error) throw paid.error;
      if (open.error) throw open.error;

      const invoices = [
        ...(paid.data || []).map(invoice => ({ date: invoice.paid_at as string, total: invoice.total, paid: true })),
        ...(open.data || []).map(invoice => ({ date: invoice.created_at as string, total: invoice.total, paid: false })),
      ];

      // Group invoices by date and sum the totals
      const revenueByDate = new Map<string, RevenuePoint>();

      invoices.forEach((invoice) => {
        const date = new Date(invoice.date);
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

        const point = revenueByDate.get(dateKey) || { date: dateKey, revenue: 0, unrealized: 0 };
        if (invoice.paid) point.revenue += invoice.total;
        else point.unrealized += invoice.total;
        revenueByDate.set(dateKey, point);
      });

      // Fill in missing dates with 0 revenue
      const filledData = fillMissingDates(revenueByDate, period, now);

      return res.status(200).json(filledData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** Eén punt in de grafiek: betaald en nog openstaand, afgerond op centen */
interface RevenuePoint {
  date: string;
  revenue: number;
  unrealized: number;
}

const round = (amount: number) => Math.round(amount * 100) / 100;

function fillMissingDates(
  data: Map<string, RevenuePoint>,
  period: string,
  endDate: Date
): RevenuePoint[] {
  const keys: string[] = [];

  if (period === 'today') {
    // Fill hours from 0 to current hour
    for (let hour = 0; hour <= endDate.getHours(); hour++) {
      keys.push(`${hour}:00`);
    }
  } else if (period === 'week' || period === 'month') {
    // Fill last 7 or 30 days
    for (let i = period === 'week' ? 6 : 29; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      keys.push(date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }));
    }
  } else if (period === 'year') {
    // Fill last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(endDate);
      date.setMonth(endDate.getMonth() - i);
      keys.push(date.toLocaleDateString('nl-NL', { month: 'short' }));
    }
  }

  return keys.map((date) => {
    const point = data.get(date);
    return { date, revenue: round(point?.revenue || 0), unrealized: round(point?.unrealized || 0) };
  });
}
