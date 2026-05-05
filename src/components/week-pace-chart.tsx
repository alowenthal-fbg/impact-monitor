'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { WeekPaceData, DayPacePoint } from '@/hooks/use-week-pace';

interface WeekPaceChartProps {
  data: WeekPaceData | null;
  isLoading?: boolean;
}

const METRICS = [
  { key: 'tickets', label: 'Tickets Sold', color: '#8884d8', format: (v: number) => v.toLocaleString() },
  { key: 'orders', label: 'Orders', color: '#ff7300', format: (v: number) => v.toLocaleString() },
  { key: 'gtv', label: 'GTV', color: '#82ca9d', format: (v: number) => `$${v.toLocaleString()}` },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

function formatAxis(value: number, metric: MetricKey): string {
  if (metric === 'gtv') {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export function WeekPaceChart({ data, isLoading }: WeekPaceChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('tickets');

  if (isLoading) {
    return (
      <div className="h-[320px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    );
  }

  if (!data) return null;

  const metricConfig = METRICS.find((m) => m.key === activeMetric)!;
  const points: DayPacePoint[] = data[activeMetric];

  const hasForecast = points.some((p) => p.forecast != null && p.forecast > 0);

  // Build chart data with actual, baseline band, projection, and forecast
  const chartData = points.map((p) => ({
    dayLabel: p.dayLabel,
    actual: p.actual,
    baseline: p.baseline,
    baselineMin: p.baselineMin,
    baselineMax: p.baselineMax,
    bandWidth: p.baselineMax - p.baselineMin,
    projected: p.projected,
    forecast: p.forecast,
  }));

  // Calculate pace status
  const currentPoint = points[data.currentDayIndex];
  const pacePercent = currentPoint && currentPoint.baseline > 0
    ? ((currentPoint.actual ?? 0) / currentPoint.baseline - 1) * 100
    : 0;
  const paceLabel = pacePercent >= 0
    ? `+${pacePercent.toFixed(0)}% ahead`
    : `${pacePercent.toFixed(0)}% behind`;
  const paceColor = pacePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  // Projected end-of-week value
  const lastPoint = points[6];
  const projectedEnd = lastPoint.projected ?? lastPoint.actual;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This Week&apos;s Pace
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            vs. trailing 4-week average
            {currentPoint && (
              <span className={`ml-2 font-medium ${paceColor}`}>
                {paceLabel}
              </span>
            )}
            {projectedEnd != null && (
              <span className="ml-2 text-gray-400 dark:text-gray-500">
                · Projected: {metricConfig.format(Math.round(projectedEnd))}
              </span>
            )}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="dayLabel"
            fontSize={12}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          <YAxis
            tickFormatter={(v) => formatAxis(v, activeMetric)}
            fontSize={12}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg">
                  <p className="mb-2 text-xs font-medium text-gray-600">{label}</p>
                  {payload.map((entry) => {
                    if (entry.value == null || entry.dataKey === 'bandWidth' || entry.dataKey === 'baselineMin') return null;
                    const v = Number(entry.value);
                    return (
                      <div key={entry.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-700">{entry.name}</span>
                        <span className="ml-auto font-medium text-gray-900">
                          {metricConfig.format(Math.round(v))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          {/* Baseline range band (min to max) using stacked areas */}
          <defs>
            <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="baselineMin"
            stroke="none"
            fill="transparent"
            fillOpacity={0}
            stackId="band"
            name="Range (min)"
            dot={false}
            activeDot={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="bandWidth"
            stroke="none"
            fill="url(#bandFill)"
            fillOpacity={1}
            stackId="band"
            name="4-Week Range"
            dot={false}
            activeDot={false}
          />
          {/* Baseline average line */}
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="4-Week Avg"
          />
          {/* Commercial forecast line */}
          {hasForecast && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Commercial Forecast"
            />
          )}
          {/* Projected line (dashed, colored) */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke={metricConfig.color}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="Projected"
            connectNulls={false}
          />
          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={metricConfig.color}
            strokeWidth={3}
            dot={{ fill: metricConfig.color, r: 4 }}
            name="This Week"
            connectNulls={false}
          />
          {/* Today marker */}
          <ReferenceLine
            x={points[data.currentDayIndex]?.dayLabel}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend key */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="12"><line x1="0" y1="6" x2="20" y2="6" stroke={metricConfig.color} strokeWidth="3" /></svg>
          This Week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="12"><line x1="0" y1="6" x2="20" y2="6" stroke={metricConfig.color} strokeWidth="2" strokeDasharray="4 4" /></svg>
          Projected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="12"><line x1="0" y1="6" x2="20" y2="6" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5 5" /></svg>
          4-Week Avg
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="12"><rect x="0" y="2" width="20" height="8" fill="#9ca3af" fillOpacity="0.2" rx="2" /></svg>
          4-Week Range
        </span>
        {hasForecast && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="12"><line x1="0" y1="6" x2="20" y2="6" stroke="#f59e0b" strokeWidth="2" /></svg>
            Commercial Forecast
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="12"><line x1="10" y1="0" x2="10" y2="12" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
          Today
        </span>
      </div>

      {/* Metric toggles */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {METRICS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveMetric(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeMetric === key
                ? 'border-transparent text-white'
                : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
            }`}
            style={
              activeMetric === key ? { backgroundColor: color } : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
