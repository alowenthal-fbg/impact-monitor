'use client';

import { Ticket, ShoppingCart, DollarSign, TrendingUp, type LucideIcon } from 'lucide-react';

const unitIcons: Record<string, LucideIcon> = {
  tickets: Ticket,
  orders: ShoppingCart,
  currency: DollarSign,
};

interface KPICardProps {
  title: string;
  value: number;
  unit: 'tickets' | 'orders' | 'currency';
  wowDelta: number | null;
  vsForecastDelta: number | null;
  prevValue?: number | null;
  forecastValue?: number | null;
  icon?: LucideIcon;
  isLoading?: boolean;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'currency') {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return value.toLocaleString('en-US');
}

function formatCompact(value: number, unit: string): string {
  if (unit === 'currency') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function KPICard({ title, value, unit, wowDelta, vsForecastDelta, prevValue, forecastValue, icon, isLoading }: KPICardProps) {
  const Icon = icon ?? unitIcons[unit] ?? TrendingUp;
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-3 h-12 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <Icon className="absolute right-4 top-4 h-5 w-5 text-gray-300 dark:text-gray-600" />
      <p className="text-base font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
        {formatValue(value, unit)}
      </p>

      {/* Comparison table */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
        <ComparisonColumn
          heading="Week over Week"
          delta={wowDelta}
          absoluteValue={prevValue}
          unit={unit}
        />
        <ComparisonColumn
          heading="vs. Forecast"
          delta={vsForecastDelta}
          absoluteValue={forecastValue}
          unit={unit}
        />
      </div>
    </div>
  );
}

function ComparisonColumn({ heading, delta, absoluteValue, unit }: {
  heading: string;
  delta: number | null;
  absoluteValue?: number | null;
  unit: string;
}) {
  const color =
    delta === null ? 'text-gray-400 dark:text-gray-500' :
    delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  const arrow =
    delta === null ? '' :
    delta >= 0 ? '\u2191' : '\u2193';

  return (
    <div>
      <p className="text-[13px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {heading}
      </p>
      <p className={`mt-0.5 text-base font-semibold ${color}`}>
        {delta !== null ? (
          <>
            {arrow} {Math.abs(delta).toFixed(1)}%
          </>
        ) : (
          <span className="font-normal">—</span>
        )}
      </p>
      {absoluteValue != null && absoluteValue > 0 && (
        <p className="mt-0.5 text-[13px] text-gray-400 dark:text-gray-500">
          {formatCompact(absoluteValue, unit)}
        </p>
      )}
    </div>
  );
}
