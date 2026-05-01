'use client';

import { useState } from 'react';
import { KPICard } from '@/components/kpi-card';
import { WeekSelector } from '@/components/week-selector';
import { useWeeklyData, useAvailableWeeks } from '@/hooks/use-weekly-data';
import { getCurrentWeek } from '@/lib/utils/week';
import { format } from 'date-fns';

function getCurrentWeekStr(): string {
  return format(getCurrentWeek(), 'yyyy-MM-dd');
}

export default function DashboardPage() {
  const currentWeekStart = getCurrentWeekStr();
  const { data: weeks } = useAvailableWeeks();
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart);

  // If current week has no data yet, default to the most recent available week
  const effectiveWeek = weeks?.includes(selectedWeek)
    ? selectedWeek
    : weeks?.[0] ?? selectedWeek;

  const { data, isLoading, error } = useWeeklyData(effectiveWeek, currentWeekStart);

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Impact Monitor</h1>
        <WeekSelector
          selectedWeek={effectiveWeek}
          currentWeekStart={currentWeekStart}
          onChange={setSelectedWeek}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load data: {error.message}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Tickets Sold"
          value={data?.totalTickets ?? 0}
          unit="tickets"
          wowDelta={data?.ticketsWow ?? null}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Orders"
          value={data?.totalOrders ?? 0}
          unit="orders"
          wowDelta={data?.ordersWow ?? null}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue (GTV)"
          value={data?.totalGtv ?? 0}
          unit="currency"
          wowDelta={data?.gtvWow ?? null}
          isLoading={isLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={data?.avgOrderValue ?? 0}
          unit="currency"
          wowDelta={data?.avgOrderValueWow ?? null}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
