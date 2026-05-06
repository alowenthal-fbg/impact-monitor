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
  ReferenceLine,
} from 'recharts';
import { formatWeekLabel } from '@/lib/utils/week';
import { format, subWeeks, subMonths, subYears, endOfYear } from 'date-fns';
import type { TrendDataPoint } from '@/hooks/use-trend-data';
import { aggregateMonthly } from '@/hooks/use-trend-data';
import type { ForecastWeekPoint } from '@/hooks/use-forecast-data';
import { aggregateForecastMonthly } from '@/hooks/use-forecast-data';

type ViewMode = 'weekly' | 'monthly';
type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';
type Horizon = 'now' | 'year';

const TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y'];

function getTimeRangeCutoff(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '1W': return subWeeks(now, 1);
    case '1M': return subMonths(now, 1);
    case '3M': return subMonths(now, 3);
    case '6M': return subMonths(now, 6);
    case '1Y': return subYears(now, 1);
  }
}

interface WeeklyTrendChartProps {
  trendData: TrendDataPoint[];
  forecastData?: ForecastWeekPoint[];
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

export function WeeklyTrendChart({ trendData, forecastData, selectedWeek, isLoading }: WeeklyTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [showForecast, setShowForecast] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>('now');
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    new Set(['total_tickets', 'total_orders', 'total_gtv'])
  );

  // If forecast is toggled off, collapse horizon back to "now"
  const effectiveHorizon: Horizon = showForecast ? horizon : 'now';

  const filteredData = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange).toISOString().split('T')[0];
    return trendData.filter((d) => d.week_start >= cutoff);
  }, [trendData, timeRange]);

  const monthlyData = useMemo(() => aggregateMonthly(filteredData), [filteredData]);

  // Filter and aggregate forecast data to match time range and horizon.
  // Horizon "now" caps forecast at today so only actuals show for past weeks;
  // "year" extends through end of current calendar year.
  const filteredForecast = useMemo(() => {
    if (!showForecast || !forecastData?.length) return [];
    const cutoff = getTimeRangeCutoff(timeRange).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const yearEndStr = endOfYear(new Date()).toISOString().split('T')[0];
    const upper = effectiveHorizon === 'now' ? todayStr : yearEndStr;
    return forecastData.filter((d) => d.week_start >= cutoff && d.week_start <= upper);
  }, [forecastData, timeRange, showForecast, effectiveHorizon]);

  const monthlyForecast = useMemo(
    () => aggregateForecastMonthly(filteredForecast),
    [filteredForecast]
  );

  const hasForecast = filteredForecast.length > 0;

  const isWeekly = viewMode === 'weekly';
  const xKey = isWeekly ? 'week_start' : 'month';

  // Merge forecast into chart data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseData: any[] = isWeekly ? filteredData : monthlyData;
    if (!hasForecast) return baseData;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forecastSource: any[] = isWeekly ? filteredForecast : monthlyForecast;
    const fcKey = isWeekly ? 'week_start' : 'month';
    const forecastMap = new Map(
      forecastSource.map((f) => [f[fcKey], f])
    );

    // Merge forecast values into existing data points
    const merged = baseData.map((point) => {
      const fc = forecastMap.get(point[xKey]);
      return {
        ...point,
        forecast_tickets: fc?.total_tickets ?? null,
        forecast_orders: fc?.total_orders ?? null,
        forecast_gtv: fc?.total_gtv ?? null,
      };
    });

    // Add forecast-only future points not in actuals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKeys = new Set(baseData.map((d: any) => d[xKey]));
    for (const fc of forecastSource) {
      const key = fc[fcKey];
      if (!existingKeys.has(key)) {
        merged.push({
          [xKey]: key,
          forecast_tickets: fc.total_tickets,
          forecast_orders: fc.total_orders,
          forecast_gtv: fc.total_gtv,
        });
      }
    }

    // Sort by the x-axis key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    merged.sort((a: any, b: any) => String(a[xKey] ?? '').localeCompare(String(b[xKey] ?? '')));
    return merged;
  }, [isWeekly, filteredData, monthlyData, hasForecast, filteredForecast, monthlyForecast, xKey]);

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
      <div className="h-[380px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    );
  }

  if (trendData.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
        No trend data available
      </div>
    );
  }

  const hasLeftAxis = visibleMetrics.has('total_tickets') || visibleMetrics.has('total_orders');
  const hasRightAxis = visibleMetrics.has('total_gtv');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isWeekly ? 'Weekly' : 'Monthly'} Trends
        </h2>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 dark:border-gray-600 dark:bg-gray-700">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Weekly / Monthly toggle */}
          <div className="flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 dark:border-gray-600 dark:bg-gray-700">
            <button
              onClick={() => setViewMode('weekly')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                isWeekly ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !isWeekly ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Forecast on/off */}
          <button
            onClick={() => setShowForecast((v) => !v)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
              showForecast
                ? 'border-transparent bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            Forecast
          </button>

          {/* Horizon: Now / Full Year (only meaningful when forecast is on) */}
          <div
            className={`flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 dark:border-gray-600 dark:bg-gray-700 ${
              showForecast ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            <button
              onClick={() => setHorizon('now')}
              disabled={!showForecast}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                effectiveHorizon === 'now'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Now
            </button>
            <button
              onClick={() => setHorizon('year')}
              disabled={!showForecast}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                effectiveHorizon === 'year'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Full Year
            </button>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey={xKey}
            tickFormatter={isWeekly ? (v) => formatWeekLabel(v).split(' - ')[0] : formatMonthLabel}
            fontSize={12}
            tick={{ fill: 'var(--chart-tick)' }}
          />
          {hasLeftAxis && (
            <YAxis
              yAxisId="left"
              tickFormatter={formatTicketAxis}
              fontSize={12}
              tick={{ fill: 'var(--chart-tick)' }}
            />
          )}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={formatGtvAxis}
              fontSize={12}
              tick={{ fill: 'var(--chart-tick)' }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const sorted = [...payload].sort(
                (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
              );
              return (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg">
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
                        <span className="ml-auto font-medium text-gray-900">{formatted}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
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
          {/* Forecast lines */}
          {hasForecast && visibleMetrics.has('total_tickets') && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="forecast_tickets"
              stroke="#8884d8"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="Tickets (Forecast)"
              connectNulls={false}
            />
          )}
          {hasForecast && visibleMetrics.has('total_orders') && (
            <Line
              yAxisId={hasLeftAxis ? 'left' : 'right'}
              type="monotone"
              dataKey="forecast_orders"
              stroke="#ff7300"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="Orders (Forecast)"
              connectNulls={false}
            />
          )}
          {hasForecast && visibleMetrics.has('total_gtv') && (
            <Line
              yAxisId={hasRightAxis ? 'right' : 'left'}
              type="monotone"
              dataKey="forecast_gtv"
              stroke="#82ca9d"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="GTV (Forecast)"
              connectNulls={false}
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

      {/* Metric toggles */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {METRICS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleMetric(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              visibleMetrics.has(key)
                ? 'border-transparent text-white'
                : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
            }`}
            style={
              visibleMetrics.has(key) ? { backgroundColor: color } : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
