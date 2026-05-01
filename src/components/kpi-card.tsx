'use client';

interface KPICardProps {
  title: string;
  value: number;
  unit: 'tickets' | 'orders' | 'currency';
  wowDelta: number | null;
  isLoading?: boolean;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'currency') {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return value.toLocaleString('en-US');
}

export function KPICard({ title, value, unit, wowDelta, isLoading }: KPICardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-16 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  const deltaColor =
    wowDelta === null ? 'text-gray-400' :
    wowDelta >= 0 ? 'text-green-600' : 'text-red-600';

  const deltaArrow =
    wowDelta === null ? '' :
    wowDelta >= 0 ? '↑' : '↓';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {formatValue(value, unit)}
      </p>
      <p className={`mt-1 text-sm ${deltaColor}`}>
        {wowDelta !== null ? (
          <>
            {deltaArrow} {Math.abs(wowDelta).toFixed(1)}% vs last week
          </>
        ) : (
          'No prior week data'
        )}
      </p>
    </div>
  );
}
