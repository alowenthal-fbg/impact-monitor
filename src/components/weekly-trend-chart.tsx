'use client';

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
import type { TrendDataPoint } from '@/hooks/use-trend-data';

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

export function WeeklyTrendChart({ trendData, selectedWeek, isLoading }: WeeklyTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] w-full animate-pulse rounded-lg bg-gray-200" />
    );
  }

  if (trendData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No trend data available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Weekly Trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="week_start"
            tickFormatter={(v) => formatWeekLabel(v).split(' - ')[0]}
            fontSize={12}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatTicketAxis}
            fontSize={12}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatGtvAxis}
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'Tickets Sold') return [value.toLocaleString(), name];
              return [`$${value.toLocaleString()}`, name];
            }}
            labelFormatter={(label) => formatWeekLabel(label)}
          />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="total_tickets"
            fill="#8884d8"
            fillOpacity={0.3}
            stroke="#8884d8"
            name="Tickets Sold"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total_gtv"
            stroke="#82ca9d"
            strokeWidth={2}
            name="GTV"
            dot={false}
          />
          {selectedWeek && (
            <ReferenceLine
              x={selectedWeek}
              yAxisId="left"
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
