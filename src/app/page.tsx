'use client';

import { useState } from 'react';
import { KPICard } from '@/components/kpi-card';
import { WeekSelector } from '@/components/week-selector';
import { WeeklyTrendChart } from '@/components/weekly-trend-chart';
import { SportBreakdown } from '@/components/sport-breakdown';
import { TopEventsTable } from '@/components/top-events-table';
import { PipelineStatus } from '@/components/pipeline-status';
import { DashboardExport } from '@/components/dashboard-export';
import { TalkTrackDownload } from '@/components/talk-track-download';
import { SubscriberManager } from '@/components/subscriber-manager';
import { useWeeklyData, useAvailableWeeks } from '@/hooks/use-weekly-data';
import { useTrendData } from '@/hooks/use-trend-data';
import { useDailyData } from '@/hooks/use-daily-data';
import { useTopEvents } from '@/hooks/use-top-events';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { getCurrentWeek } from '@/lib/utils/week';
import { format, addDays } from 'date-fns';

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
    : weeks?.[0] ?? currentWeekStart;

  const weekEnd = format(addDays(new Date(effectiveWeek + 'T00:00:00'), 6), 'yyyy-MM-dd');

  const { data: kpiData, isLoading: kpiLoading, error } = useWeeklyData(effectiveWeek, currentWeekStart);
  const { data: trendData, isLoading: trendLoading } = useTrendData();
  const { data: sportData, isLoading: sportLoading } = useDailyData(effectiveWeek, weekEnd);
  const { data: topEvents, isLoading: eventsLoading } = useTopEvents(effectiveWeek, weekEnd);
  const { data: pipelineStatus, isLoading: statusLoading } = usePipelineStatus();

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-3xl font-bold text-gray-900">Impact Monitor</h1>
          <PipelineStatus
            status={pipelineStatus?.status}
            timestamp={pipelineStatus?.created_at}
            errorMessage={pipelineStatus?.error_message}
            isLoading={statusLoading}
          />
        </div>
        <div className="flex items-center gap-4">
          <TalkTrackDownload weekStart={effectiveWeek} />
          <DashboardExport weekStart={effectiveWeek} />
          <WeekSelector
            selectedWeek={effectiveWeek}
            currentWeekStart={currentWeekStart}
            onChange={setSelectedWeek}
          />
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load data: {error.message}
        </div>
      )}

      <div id="dashboard-export-target" className="mt-8 rounded-lg bg-white p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Total Tickets Sold"
            value={kpiData?.totalTickets ?? 0}
            unit="tickets"
            wowDelta={kpiData?.ticketsWow ?? null}
            isLoading={kpiLoading}
          />
          <KPICard
            title="Total Orders"
            value={kpiData?.totalOrders ?? 0}
            unit="orders"
            wowDelta={kpiData?.ordersWow ?? null}
            isLoading={kpiLoading}
          />
          <KPICard
            title="Total Revenue (GTV)"
            value={kpiData?.totalGtv ?? 0}
            unit="currency"
            wowDelta={kpiData?.gtvWow ?? null}
            isLoading={kpiLoading}
          />
          <KPICard
            title="Avg Order Value"
            value={kpiData?.avgOrderValue ?? 0}
            unit="currency"
            wowDelta={kpiData?.avgOrderValueWow ?? null}
            isLoading={kpiLoading}
          />
          <KPICard
            title="Gross Profit"
            value={kpiData?.totalGrossProfit ?? 0}
            unit="currency"
            wowDelta={kpiData?.grossProfitWow ?? null}
            isLoading={kpiLoading}
          />
        </div>

        <div className="mt-8">
          <WeeklyTrendChart
            trendData={trendData ?? []}
            selectedWeek={effectiveWeek}
            isLoading={trendLoading}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SportBreakdown
            sportData={sportData ?? []}
            metric="tickets"
            isLoading={sportLoading}
          />
          <SportBreakdown
            sportData={sportData ?? []}
            metric="gtv"
            isLoading={sportLoading}
          />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Events This Week</h2>
          <TopEventsTable events={topEvents ?? []} isLoading={eventsLoading} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Admin Settings</h2>
        <SubscriberManager />
      </div>
    </div>
  );
}
