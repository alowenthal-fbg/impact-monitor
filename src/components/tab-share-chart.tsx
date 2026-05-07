'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts';
import type { TabShareRow } from '@/hooks/use-ticketing-engagement';

interface TabShareChartProps {
  data: TabShareRow[];
  isLoading?: boolean;
}

function formatAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

const TICKETS_COLOR = '#8884d8';
const OTHER_COLOR = '#cbd5e1';

export function TabShareChart({ data, isLoading }: TabShareChartProps) {
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

  const total = data.reduce((s, r) => s + r.uniques, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          L30 Bottom-Nav Tabs — Unique-Day Visits
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tickets vs. other FanApp tabs (sum of daily uniques across last 30 days)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="tab" fontSize={12} tick={{ fill: 'var(--chart-tick)' }} />
          <YAxis
            tickFormatter={formatAxis}
            fontSize={11}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          <Tooltip
            cursor={false}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
            labelStyle={{ color: '#4b5563' }}
            itemStyle={{ color: '#111827' }}
            formatter={(value) => {
              const v = Number(value);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
              return [`${v.toLocaleString()} (${pct}%)`, 'Unique-day visits'];
            }}
          />
          <Bar dataKey="uniques" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.tab}
                fill={entry.tab === 'Tickets' ? TICKETS_COLOR : OTHER_COLOR}
              />
            ))}
            <LabelList
              dataKey="uniques"
              position="top"
              fontSize={11}
              fill="var(--chart-tick)"
              formatter={(value) => formatAxis(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
