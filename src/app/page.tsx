'use client';

import { useState } from 'react';
import Image from 'next/image';
import { KPICard } from '@/components/kpi-card';
import { WeekSelector, type ViewMode } from '@/components/week-selector';
import { WeeklyTrendChart } from '@/components/weekly-trend-chart';
import { WeekPaceChart } from '@/components/week-pace-chart';
import { SportBreakdownPanel } from '@/components/sport-breakdown';
import { SportSeasonalityChart } from '@/components/sport-seasonality-chart';
import { TicketsTabTrendChart } from '@/components/tickets-tab-trend-chart';
import { TabShareChart } from '@/components/tab-share-chart';
import { TopEventsTable } from '@/components/top-events-table';
import { PipelineStatus } from '@/components/pipeline-status';
import { DashboardExport } from '@/components/dashboard-export';
import { TalkTrackDownload } from '@/components/weekly-summary-download';
import { SubscriberManager } from '@/components/subscriber-manager';
import { useTicketingEngagement } from '@/hooks/use-ticketing-engagement';
import { useWeeklyData, useAvailableWeeks } from '@/hooks/use-weekly-data';
import { useYtdData } from '@/hooks/use-ytd-data';
import { useTrendData } from '@/hooks/use-trend-data';
import { useForecastData } from '@/hooks/use-forecast-data';
import { useDailyData } from '@/hooks/use-daily-data';
import { useTopEvents } from '@/hooks/use-top-events';
import { useWeekPace } from '@/hooks/use-week-pace';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { getCurrentWeek } from '@/lib/utils/week';
import { format, addDays } from 'date-fns';
import { ReceiptText } from 'lucide-react';

function getCurrentWeekStr(): string {
  return format(getCurrentWeek(), 'yyyy-MM-dd');
}

type DashboardTab = 'commercial' | 'engagement';

export default function DashboardPage() {
  const currentWeekStart = getCurrentWeekStr();
  const { data: weeks } = useAvailableWeeks();
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [activeTab, setActiveTab] = useState<DashboardTab>('commercial');

  // If current week has no data yet, default to the most recent available week
  const effectiveWeek = weeks?.includes(selectedWeek)
    ? selectedWeek
    : weeks?.[0] ?? currentWeekStart;

  const weekEnd = format(addDays(new Date(effectiveWeek + 'T00:00:00'), 6), 'yyyy-MM-dd');

  const isYtd = viewMode === 'ytd';
  const ytdStart = `${new Date().getFullYear()}-01-01`;
  const ytdEnd = format(new Date(), 'yyyy-MM-dd');

  const { data: kpiData, isLoading: kpiLoading, error } = useWeeklyData(effectiveWeek, currentWeekStart);
  const { data: ytdKpiData, isLoading: ytdKpiLoading, error: ytdError } = useYtdData(isYtd);
  const { data: trendData, isLoading: trendLoading } = useTrendData();
  const { data: forecastData } = useForecastData();
  const { data: sportData, isLoading: sportLoading } = useDailyData(
    isYtd ? ytdStart : effectiveWeek,
    isYtd ? ytdEnd : weekEnd
  );
  const { data: topEvents, isLoading: eventsLoading } = useTopEvents(
    isYtd ? ytdStart : effectiveWeek,
    isYtd ? ytdEnd : weekEnd
  );
  const { data: paceData, isLoading: paceLoading } = useWeekPace(currentWeekStart);
  const { data: pipelineStatus, isLoading: statusLoading } = usePipelineStatus();
  const { data: engagementData, isLoading: engagementLoading } = useTicketingEngagement();

  // Compute vs-forecast deltas for the selected week
  const weekForecast = forecastData?.find(f => f.week_start === effectiveWeek);
  const computeForecastDelta = (actual: number, forecast: number | undefined): number | null => {
    if (forecast == null || forecast === 0) return null;
    return ((actual - forecast) / forecast) * 100;
  };

  const ticketsVsForecast = computeForecastDelta(kpiData?.totalTickets ?? 0, weekForecast?.total_tickets);
  const ordersVsForecast = computeForecastDelta(kpiData?.totalOrders ?? 0, weekForecast?.total_orders);
  const gtvVsForecast = computeForecastDelta(kpiData?.totalGtv ?? 0, weekForecast?.total_gtv);
  const avgOrderForecast = weekForecast && weekForecast.total_orders > 0
    ? weekForecast.total_gtv / weekForecast.total_orders
    : undefined;
  const aovVsForecast = computeForecastDelta(kpiData?.avgOrderValue ?? 0, avgOrderForecast);

  // Pick the active KPI data based on view mode
  const activeKpi = isYtd ? ytdKpiData : kpiData;
  const activeKpiLoading = isYtd ? ytdKpiLoading : kpiLoading;
  const activeError = isYtd ? ytdError : error;

  return (
    <div className="flex min-h-screen flex-col bg-background p-8 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/fanatics-flag-black.svg"
            alt="Fanatics"
            width={24}
            height={20}
            className="block dark:hidden"
          />
          <Image
            src="/fanatics-flag-white.svg"
            alt="Fanatics"
            width={24}
            height={20}
            className="hidden dark:block"
          />
          <h1 className="text-3xl font-bold">Fanatics Tickets</h1>
        </div>
        <div className="flex items-stretch gap-4">
          <WeekSelector
            selectedWeek={effectiveWeek}
            currentWeekStart={currentWeekStart}
            onChange={setSelectedWeek}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          >
            <TalkTrackDownload weekStart={effectiveWeek} isLiveWeek={effectiveWeek === currentWeekStart} />
            <DashboardExport weekStart={effectiveWeek} />
          </WeekSelector>
          <PipelineStatus
            status={pipelineStatus?.status}
            timestamp={pipelineStatus?.started_at}
            errorMessage={pipelineStatus?.error_message}
            isLoading={statusLoading}
          />
        </div>
      </div>

      {activeError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Failed to load data: {activeError.message}
        </div>
      )}

      <div className="mt-8 flex items-center gap-8 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('commercial')}
          className={`-mb-px border-b-2 px-1 pb-3 text-3xl font-bold transition-colors ${
            activeTab === 'commercial'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
          }`}
        >
          Commercial
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('engagement')}
          className={`-mb-px border-b-2 px-1 pb-3 text-3xl font-bold transition-colors ${
            activeTab === 'engagement'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
          }`}
        >
          Engagement
        </button>
      </div>

      {activeTab === 'commercial' ? (
      <div id="dashboard-export-target" className="mt-8 rounded-lg bg-white p-6 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Tickets Sold"
            value={activeKpi?.totalTickets ?? 0}
            unit="tickets"
            wowDelta={activeKpi?.ticketsWow ?? null}
            vsForecastDelta={isYtd ? null : ticketsVsForecast}
            prevValue={activeKpi?.prevTickets}
            forecastValue={isYtd ? undefined : weekForecast?.total_tickets}
            comparisonLabel={isYtd ? 'vs. Prior Year' : undefined}
            isLoading={activeKpiLoading}
          />
          <KPICard
            title="Total Orders"
            value={activeKpi?.totalOrders ?? 0}
            unit="orders"
            wowDelta={activeKpi?.ordersWow ?? null}
            vsForecastDelta={isYtd ? null : ordersVsForecast}
            prevValue={activeKpi?.prevOrders}
            forecastValue={isYtd ? undefined : weekForecast?.total_orders}
            comparisonLabel={isYtd ? 'vs. Prior Year' : undefined}
            isLoading={activeKpiLoading}
          />
          <KPICard
            title="Total Revenue (GTV)"
            value={activeKpi?.totalGtv ?? 0}
            unit="currency"
            wowDelta={activeKpi?.gtvWow ?? null}
            vsForecastDelta={isYtd ? null : gtvVsForecast}
            prevValue={activeKpi?.prevGtv}
            forecastValue={isYtd ? undefined : weekForecast?.total_gtv}
            comparisonLabel={isYtd ? 'vs. Prior Year' : undefined}
            isLoading={activeKpiLoading}
          />
          <KPICard
            title="Avg Order Value"
            value={activeKpi?.avgOrderValue ?? 0}
            unit="currency"
            icon={ReceiptText}
            wowDelta={activeKpi?.avgOrderValueWow ?? null}
            vsForecastDelta={isYtd ? null : aovVsForecast}
            prevValue={activeKpi?.prevAvgOrderValue}
            forecastValue={isYtd ? undefined : avgOrderForecast}
            comparisonLabel={isYtd ? 'vs. Prior Year' : undefined}
            isLoading={activeKpiLoading}
          />
        </div>

        {!isYtd && effectiveWeek === currentWeekStart && (
          <div className="mt-8">
            <WeekPaceChart data={paceData ?? null} isLoading={paceLoading} />
          </div>
        )}

        <div className="mt-8">
          <WeeklyTrendChart
            trendData={trendData ?? []}
            forecastData={forecastData}
            selectedWeek={effectiveWeek}
            isLoading={trendLoading}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SportBreakdownPanel
            sportData={sportData ?? []}
            isLoading={sportLoading}
          />
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{isYtd ? 'Top Events YTD' : 'Top Events This Week'}</h2>
            <TopEventsTable events={topEvents?.events ?? []} weeklyGtv={topEvents?.weeklyGtv ?? 0} isLoading={eventsLoading} />
          </div>
        </div>

        <div className="mt-8">
          <SportSeasonalityChart />
        </div>
      </div>
      ) : (
        <div className="mt-8 space-y-6">
          <TicketsTabTrendChart
            data={engagementData?.dailyTickets ?? []}
            isLoading={engagementLoading}
          />
          <TabShareChart
            data={engagementData?.tabShareL30 ?? []}
            isLoading={engagementLoading}
          />
        </div>
      )}

      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Admin Settings</h2>
        <SubscriberManager />
      </div>
    </div>
  );
}
