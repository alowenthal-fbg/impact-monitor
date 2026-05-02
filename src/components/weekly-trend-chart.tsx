'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatWeekLabel } from '@/lib/utils/week';
import { format } from 'date-fns';
import type { TrendDataPoint } from '@/hooks/use-trend-data';
import { aggregateMonthly } from '@/hooks/use-trend-data';

type ViewMode = 'weekly' | 'monthly';

interface WeeklyTrendChartProps {
  trendData: TrendDataPoint[];
  selectedWeek: string;
  isLoading?: boolean;
}

function formatTicketAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

function formatGtvAxis(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function formatMonthLabel(monthStr: string): string {
  const date = new Date(monthStr + '-01T00:00:00');
  return format(date, 'MMM yyyy');
}

const METRICS = [
  { key: 'total_tickets', label: 'Tickets Sold', color: '#8884d8' },
  { key: 'total_orders', label: 'Orders', color: '#ff7300' },
  { key: 'total_gtv', label: 'GTV', color: '#82ca9d' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

export function WeeklyTrendChart({ trendData, selectedWeek, isLoading }: WeeklyTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    new Set(['total_tickets', 'total_orders', 'total_gtv'])
  );

  const monthlyData = useMemo(() => aggregateMonthly(trendData), [trendData]);

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="h-[380px] w-full animate-pulse rounded-lg bg-gray-200" />
    );
  }

  if (trendData.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No trend data available
      </div>
    );
  }

  const isWeekly = viewMode === 'weekly';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any[] = isWeekly ? trendData : monthlyData;
  const xKey = isWeekly ? 'week_start' : 'month';

  const hasLeftAxis = visibleMetrics.has('total_tickets') || visibleMetrics.has('total_orders');
  const hasRightAxis = visibleMetrics.has('total_gtv');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {isWeekly ? 'Weekly' : 'Monthly'} Trends
        </h2>

        <div className="flex items-center gap-4">
          {/* Metric toggles */}
          <div className="flex items-center gap-2">
            {METRICS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => toggleMetric(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  visibleMetrics.has(key)
                    ? 'border-transparent text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
                style={
                  visibleMetrics.has(key) ? { backgroundColor: color } : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* Weekly / Monthly toggle */}
          <div className="flex rounded-lg border border-gray-300 bg-gray-100 p-0.5">
            <button
              onClick={() => setViewMode('weekly')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                isWeekly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !isWeekly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickFormatter={isWeekly ? (v) => formatWeekLabel(v).split(' - ')[0] : formatMonthLabel}
            fontSize={12}
          />
          {hasLeftAxis && (
            <YAxis
              yAxisId="left"
              tickFormatter={formatTicketAxis}
              fontSize={12}
            />
          )}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={formatGtvAxis}
              fontSize={12}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const sorted = [...payload].sort(
                (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
              );
              return (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-medium text-gray-600">
                    {isWeekly ? formatWeekLabel(String(label)) : formatMonthLabel(String(label))}
                  </p>
                  {sorted.map((entry) => {
                    const v = Number(entry.value);
                    const formatted = entry.name === 'GTV' ? `$${v.toLocaleString()}` : v.toLocaleString();
                    return (
                      <div key={entry.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-700">{entry.name}</span>
                        <span className="ml-auto font-medium">{formatted}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Legend />
          {visibleMetrics.has('total_tickets') && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="total_tickets"
              fill="#8884d8"
              fillOpacity={0.3}
              stroke="#8884d8"
              name="Tickets Sold"
            />
          )}
          {visibleMetrics.has('total_orders') && (
            <Line
              yAxisId={hasLeftAxis ? 'left' : 'right'}
              type="monotone"
              dataKey="total_orders"
              stroke="#ff7300"
              strokeWidth={2}
              name="Orders"
              dot={false}
            />
          )}
          {visibleMetrics.has('total_gtv') && (
            <Line
              yAxisId={hasRightAxis ? 'right' : 'left'}
              type="monotone"
              dataKey="total_gtv"
              stroke="#82ca9d"
              strokeWidth={2}
              name="GTV"
              dot={false}
            />
          )}
          {isWeekly && selectedWeek && (
            <ReferenceLine
              x={selectedWeek}
              yAxisId={hasLeftAxis ? 'left' : 'right'}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
