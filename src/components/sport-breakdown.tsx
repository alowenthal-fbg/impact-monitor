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
} from 'recharts';
import type { SportData } from '@/hooks/use-daily-data';

interface SportBreakdownProps {
  sportData: SportData[];
  metric: 'tickets' | 'gtv';
  isLoading?: boolean;
}

function formatGtvLabel(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
}

export function SportBreakdown({ sportData, metric, isLoading }: SportBreakdownProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] w-full animate-pulse rounded-lg bg-gray-200" />
    );
  }

  if (sportData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No sport data available
      </div>
    );
  }

  const dataKey = metric === 'tickets' ? 'tickets' : 'gtv';
  const title = metric === 'tickets' ? 'Tickets by Sport' : 'GTV by Sport';
  const fill = metric === 'tickets' ? '#8884d8' : '#82ca9d';

  const sortedData = [...sportData].sort((a, b) =>
    metric === 'tickets' ? b.tickets - a.tickets : b.gtv - a.gtv
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sortedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="sport" fontSize={12} />
          <YAxis
            tickFormatter={metric === 'gtv' ? formatGtvLabel : undefined}
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number) =>
              metric === 'gtv'
                ? [`$${value.toLocaleString()}`, 'GTV']
                : [value.toLocaleString(), 'Tickets']
            }
          />
          <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey={metric === 'tickets' ? 'ticketPercentage' : dataKey}
              position="top"
              fontSize={11}
              formatter={(value: number) =>
                metric === 'tickets'
                  ? `${value.toFixed(1)}%`
                  : formatGtvLabel(value)
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
