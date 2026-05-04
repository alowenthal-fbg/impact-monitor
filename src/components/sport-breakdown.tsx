'use client';

import { useState, useMemo } from 'react';
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

type Metric = 'tickets' | 'gtv' | 'avgOrderValue' | 'avgTicketsPerOrder';

interface SportBreakdownPanelProps {
  sportData: SportData[];
  isLoading?: boolean;
}

const SPORT_EMOJI: Record<string, string> = {
  Baseball: '\u26BE',
  Basketball: '\uD83C\uDFC0',
  Hockey: '\uD83C\uDFD2',
  Soccer: '\u26BD',
  Football: '\uD83C\uDFC8',
  Wrestling: '\uD83E\uDD3C',
  Lacrosse: '\uD83E\uDD4D',
  Tennis: '\uD83C\uDFBE',
  Golf: '\u26F3',
  'Motorsports/Racing': '\uD83C\uDFCE\uFE0F',
  Boxing: '\uD83E\uDD4A',
  MMA: '\uD83E\uDD4A',
  Volleyball: '\uD83C\uDFD0',
  Cricket: '\uD83C\uDFCF',
  Rugby: '\uD83C\uDFC9',
  Equestrian: '\uD83D\uDC34',
};

function sportWithEmoji(sport: string): string {
  const emoji = SPORT_EMOJI[sport];
  return emoji ? `${emoji} ${sport}` : sport;
}

const TABS: { key: Metric; label: string }[] = [
  { key: 'tickets', label: 'Tickets Sold' },
  { key: 'gtv', label: 'GTV' },
  { key: 'avgOrderValue', label: 'AOV' },
  { key: 'avgTicketsPerOrder', label: 'Tickets / Order' },
];

const METRIC_CONFIG: Record<Metric, {
  dataKey: keyof SportData;
  sortKey: keyof SportData;
  fill: string;
  isCurrency: boolean;
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
}> = {
  tickets: {
    dataKey: 'tickets',
    sortKey: 'tickets',
    fill: '#8884d8',
    isCurrency: false,
    formatValue: (v) => v.toLocaleString(),
    formatAxis: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v),
  },
  gtv: {
    dataKey: 'gtv',
    sortKey: 'gtv',
    fill: '#82ca9d',
    isCurrency: true,
    formatValue: (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`,
    formatAxis: (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`,
  },
  avgOrderValue: {
    dataKey: 'avgOrderValue',
    sortKey: 'avgOrderValue',
    fill: '#ff7300',
    isCurrency: true,
    formatValue: (v) => `$${v.toFixed(2)}`,
    formatAxis: (v) => `$${v.toFixed(0)}`,
  },
  avgTicketsPerOrder: {
    dataKey: 'avgTicketsPerOrder',
    sortKey: 'avgTicketsPerOrder',
    fill: '#8dd1e1',
    isCurrency: false,
    formatValue: (v) => v.toFixed(2),
    formatAxis: (v) => v.toFixed(1),
  },
};

export function SportBreakdownPanel({ sportData, isLoading }: SportBreakdownPanelProps) {
  const [activeTab, setActiveTab] = useState<Metric>('tickets');
  const config = METRIC_CONFIG[activeTab];

  const chartData = useMemo(() => {
    const withEmoji = sportData.map((s) => ({
      ...s,
      sportLabel: sportWithEmoji(s.sport),
    }));
    return [...withEmoji].sort(
      (a, b) => (b[config.sortKey] as number) - (a[config.sortKey] as number)
    );
  }, [sportData, config.sortKey]);

  if (isLoading) {
    return (
      <div className="h-[380px] w-full animate-pulse rounded-lg bg-gray-200" />
    );
  }

  if (sportData.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No sport data available
      </div>
    );
  }

  const tabLabel = TABS.find((t) => t.key === activeTab)!.label;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">By Sport</h2>
        <div className="flex rounded-lg border border-gray-300 bg-gray-100 p-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="sportLabel" fontSize={12} />
          <YAxis tickFormatter={config.formatAxis} fontSize={12} />
          <Tooltip
            formatter={(value) => {
              const v = Number(value);
              const label = config.isCurrency
                ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : v.toLocaleString();
              return [label, tabLabel];
            }}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey={config.dataKey} fill={config.fill} radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey={config.dataKey}
              position="top"
              fontSize={11}
              formatter={(value) => config.formatValue(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
