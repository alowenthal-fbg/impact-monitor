'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import type { TicketingDailyPoint } from '@/hooks/use-ticketing-engagement';

interface TicketsTabTrendChartProps {
  data: TicketingDailyPoint[];
  isLoading?: boolean;
}

function formatAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

function formatDateLabel(dateStr: string): string {
  return format(new Date(dateStr + 'T00:00:00'), 'MMM d');
}

export function TicketsTabTrendChart({ data, isLoading }: TicketsTabTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-[320px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
        No Amplitude data yet — run the pipeline to populate.
      </div>
    );
  }

  const l30Total = data.slice(-30).reduce((sum, d) => sum + d.tab_uniques_tickets, 0);
  const avgDaily = Math.round(l30Total / Math.min(data.length, 30));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tickets Tab — Daily Uniques
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            FanApp bottom-nav taps on TICKETS (Amplitude)
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">L30 unique-day visits</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {l30Total.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg / day</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {avgDaily.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="metric_date"
            tickFormatter={formatDateLabel}
            fontSize={11}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          <YAxis
            tickFormatter={formatAxis}
            fontSize={11}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
            labelStyle={{ color: '#4b5563' }}
            itemStyle={{ color: '#111827' }}
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value) => [Number(value).toLocaleString(), 'Uniques']}
          />
          <Line
            type="monotone"
            dataKey="tab_uniques_tickets"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
            name="Tickets tab uniques"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
