import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateTalkTrack } from '@/lib/ai/talk-track';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { getCurrentWeek } from '@/lib/utils/week';
import { format, addDays, subWeeks, startOfWeek, differenceInDays } from 'date-fns';
import type { WeekData } from '@/lib/ai/narrative';
import type { SportBreakdown, TopEvent, LiveWeekContext, DayOfWeekStat } from '@/lib/ai/talk-track';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function POST(request: NextRequest) {
  try {
    const { weekStart } = await request.json();

    if (!weekStart) {
      return errorResponse('weekStart is required', 'MISSING_PARAMETER', 400);
    }

    const supabase = createServerClient();

    // Fetch current week data
    const { data: weekData, error: weekError } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('week_start', weekStart)
      .single();

    if (weekError || !weekData) {
      return errorResponse('Week data not found', 'WEEK_NOT_FOUND', 404);
    }

    // Fetch previous week data
    const prevWeekStart = new Date(weekStart + 'T00:00:00');
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

    const { data: prevWeekData } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('week_start', prevWeekStartStr)
      .single();

    // Fetch sport breakdown for current week
    const weekEnd = new Date(weekStart + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const { data: sportRaw } = await supabase
      .from('daily_metrics')
      .select('sport, tickets_sold, gtv')
      .eq('source', 'tm_api')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEndStr)
      .not('sport', 'is', null);

    // Aggregate sport breakdown
    const sportMap = new Map<string, { tickets: number; gtv: number }>();
    let totalTickets = 0;

    for (const row of sportRaw ?? []) {
      const sport = row.sport || 'Unknown';
      const tickets = row.tickets_sold || 0;
      const gtv = row.gtv || 0;
      totalTickets += tickets;

      const existing = sportMap.get(sport);
      if (existing) {
        existing.tickets += tickets;
        existing.gtv += gtv;
      } else {
        sportMap.set(sport, { tickets, gtv });
      }
    }

    const sportBreakdown: SportBreakdown[] = Array.from(sportMap.entries())
      .map(([sport, data]) => ({
        sport,
        tickets: data.tickets,
        gtv: data.gtv,
        percentOfTotal: totalTickets > 0 ? (data.tickets / totalTickets) * 100 : 0,
      }))
      .sort((a, b) => b.gtv - a.gtv);

    // Fetch top events (aggregate by event then take top 5)
    const { data: eventsRaw } = await supabase
      .from('daily_metrics')
      .select('sport, event_name, gtv')
      .eq('source', 'tm_api')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEndStr)
      .not('event_name', 'is', null);

    const eventMap = new Map<string, TopEvent>();
    for (const row of eventsRaw ?? []) {
      const key = `${row.sport}::${row.event_name}`;
      const existing = eventMap.get(key);
      if (existing) {
        existing.gtv += row.gtv || 0;
      } else {
        eventMap.set(key, {
          sport: row.sport || 'Unknown',
          eventName: row.event_name,
          gtv: row.gtv || 0,
        });
      }
    }

    const topEvents = Array.from(eventMap.values())
      .sort((a, b) => b.gtv - a.gtv)
      .slice(0, 5);

    // Build WeekData structs
    const currentWeek: WeekData = {
      weekStart: weekData.week_start,
      totalTickets: weekData.total_tickets || 0,
      totalOrders: weekData.total_orders || 0,
      totalGtv: weekData.total_gtv || 0,
      totalFaceValue: weekData.total_face_value || 0,
      totalGrossProfit: weekData.total_gross_profit || 0,
    };

    const previousWeek: WeekData | null = prevWeekData ? {
      weekStart: prevWeekData.week_start,
      totalTickets: prevWeekData.total_tickets || 0,
      totalOrders: prevWeekData.total_orders || 0,
      totalGtv: prevWeekData.total_gtv || 0,
      totalFaceValue: prevWeekData.total_face_value || 0,
      totalGrossProfit: prevWeekData.total_gross_profit || 0,
    } : null;

    // Determine if the week is live (in-progress)
    const currentWeekStart = format(getCurrentWeek(), 'yyyy-MM-dd');
    const isLiveWeek = weekStart === currentWeekStart;

    const liveContext = isLiveWeek
      ? await buildLiveWeekContext(supabase, weekStart)
      : null;

    const talkTrack = await generateTalkTrack(
      currentWeek,
      previousWeek,
      sportBreakdown,
      topEvents,
      liveContext
    );

    return successResponse({ talkTrack, isLiveWeek });
  } catch (error) {
    console.error('Talk track generation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to generate talk track',
      'GENERATION_ERROR',
      500
    );
  }
}

type SupabaseServerClient = ReturnType<typeof createServerClient>;

async function buildLiveWeekContext(
  supabase: SupabaseServerClient,
  weekStart: string
): Promise<LiveWeekContext | null> {
  const fourWeeksAgo = format(subWeeks(new Date(weekStart + 'T00:00:00'), 4), 'yyyy-MM-dd');
  const weekEnd = format(addDays(new Date(weekStart + 'T00:00:00'), 6), 'yyyy-MM-dd');

  const [metricsResult, forecastResult] = await Promise.all([
    supabase
      .from('daily_metrics')
      .select('metric_date, tickets_sold, orders, gtv')
      .eq('source', 'tm_api')
      .gte('metric_date', fourWeeksAgo)
      .order('metric_date', { ascending: true }),
    supabase
      .from('forecast_metrics')
      .select('metric_date, tickets_sold, orders, gtv')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEnd)
      .order('metric_date', { ascending: true }),
  ]);

  const rows = metricsResult.data ?? [];
  if (rows.length === 0) return null;

  // Group by week start (Monday)
  const weekBuckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const date = new Date(row.metric_date + 'T00:00:00');
    const weekMon = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!weekBuckets.has(weekMon)) weekBuckets.set(weekMon, []);
    weekBuckets.get(weekMon)!.push(row);
  }

  const currentWeekRows = weekBuckets.get(weekStart) ?? [];
  const baselineWeekKeys = [...weekBuckets.keys()].filter((k) => k < weekStart);
  if (baselineWeekKeys.length === 0) return null;

  // Per-day-of-week baseline stats (avg across last 4 weeks)
  type DailyAgg = { tickets: number; orders: number; gtv: number };
  const baselineDayTotals: DailyAgg[][] = Array.from({ length: 7 }, () => []);

  for (const weekKey of baselineWeekKeys) {
    const weekRows = weekBuckets.get(weekKey)!;
    const dayTotals: DailyAgg[] = Array.from({ length: 7 }, () => ({ tickets: 0, orders: 0, gtv: 0 }));
    for (const row of weekRows) {
      const dayIdx = differenceInDays(
        new Date(row.metric_date + 'T00:00:00'),
        new Date(weekKey + 'T00:00:00')
      );
      if (dayIdx >= 0 && dayIdx < 7) {
        dayTotals[dayIdx].tickets += row.tickets_sold ?? 0;
        dayTotals[dayIdx].orders += row.orders ?? 0;
        dayTotals[dayIdx].gtv += Number(row.gtv ?? 0);
      }
    }
    for (let d = 0; d < 7; d++) {
      baselineDayTotals[d].push(dayTotals[d]);
    }
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const baselineAvgByDay = baselineDayTotals.map((dayArr) => ({
    tickets: avg(dayArr.map((d) => d.tickets)),
    orders: avg(dayArr.map((d) => d.orders)),
    gtv: avg(dayArr.map((d) => d.gtv)),
  }));

  // Current week actuals per day
  const currentDayTotals: DailyAgg[] = Array.from({ length: 7 }, () => ({ tickets: 0, orders: 0, gtv: 0 }));
  const daysWithDataSet = new Set<number>();
  for (const row of currentWeekRows) {
    const dayIdx = differenceInDays(
      new Date(row.metric_date + 'T00:00:00'),
      new Date(weekStart + 'T00:00:00')
    );
    if (dayIdx >= 0 && dayIdx < 7) {
      currentDayTotals[dayIdx].tickets += row.tickets_sold ?? 0;
      currentDayTotals[dayIdx].orders += row.orders ?? 0;
      currentDayTotals[dayIdx].gtv += Number(row.gtv ?? 0);
      if ((row.tickets_sold ?? 0) > 0 || (row.gtv ?? 0) > 0 || (row.orders ?? 0) > 0) {
        daysWithDataSet.add(dayIdx);
      }
    }
  }

  // "Days with data" = count of days with any actual data (not calendar day — safer
  // given TM data lag). If 0, fall back to 1 so prompt doesn't degenerate.
  const daysWithData = daysWithDataSet.size > 0 ? daysWithDataSet.size : 1;
  const daysRemaining = Math.max(0, 7 - daysWithData);
  // The last index we consider "actual" — contiguous days from Monday through the highest reported day
  const lastReportedIdx = daysWithDataSet.size > 0 ? Math.max(...daysWithDataSet) : -1;

  // Actuals through today (sum of per-day through last reported day)
  const actualsThroughToday = { tickets: 0, orders: 0, gtv: 0 };
  for (let d = 0; d <= lastReportedIdx; d++) {
    actualsThroughToday.tickets += currentDayTotals[d].tickets;
    actualsThroughToday.orders += currentDayTotals[d].orders;
    actualsThroughToday.gtv += currentDayTotals[d].gtv;
  }

  // Pace ratio: actual-through-today / baseline-through-today (GTV-weighted)
  const baselineThroughToday = { tickets: 0, orders: 0, gtv: 0 };
  for (let d = 0; d <= lastReportedIdx; d++) {
    baselineThroughToday.tickets += baselineAvgByDay[d].tickets;
    baselineThroughToday.orders += baselineAvgByDay[d].orders;
    baselineThroughToday.gtv += baselineAvgByDay[d].gtv;
  }

  // Use GTV pace ratio as the primary; project each metric using its own baseline total × ratio
  const paceRatioGtv = baselineThroughToday.gtv > 0
    ? actualsThroughToday.gtv / baselineThroughToday.gtv
    : 1;
  const paceRatioTickets = baselineThroughToday.tickets > 0
    ? actualsThroughToday.tickets / baselineThroughToday.tickets
    : 1;
  const paceRatioOrders = baselineThroughToday.orders > 0
    ? actualsThroughToday.orders / baselineThroughToday.orders
    : 1;

  const totalBaseline = {
    tickets: baselineAvgByDay.reduce((s, d) => s + d.tickets, 0),
    orders: baselineAvgByDay.reduce((s, d) => s + d.orders, 0),
    gtv: baselineAvgByDay.reduce((s, d) => s + d.gtv, 0),
  };

  const paceProjection = {
    tickets: totalBaseline.tickets * paceRatioTickets,
    orders: totalBaseline.orders * paceRatioOrders,
    gtv: totalBaseline.gtv * paceRatioGtv,
    paceRatio: paceRatioGtv,
  };

  // Commercial forecast (sum over the week)
  const forecastByDay: DailyAgg[] = Array.from({ length: 7 }, () => ({ tickets: 0, orders: 0, gtv: 0 }));
  if (forecastResult.data) {
    for (const row of forecastResult.data) {
      const dayIdx = differenceInDays(
        new Date(row.metric_date + 'T00:00:00'),
        new Date(weekStart + 'T00:00:00')
      );
      if (dayIdx >= 0 && dayIdx < 7) {
        forecastByDay[dayIdx].tickets += row.tickets_sold ?? 0;
        forecastByDay[dayIdx].orders += row.orders ?? 0;
        forecastByDay[dayIdx].gtv += Number(row.gtv ?? 0);
      }
    }
  }
  const commercialForecast = {
    tickets: forecastByDay.reduce((s, d) => s + d.tickets, 0),
    orders: forecastByDay.reduce((s, d) => s + d.orders, 0),
    gtv: forecastByDay.reduce((s, d) => s + d.gtv, 0),
    hasForecast: forecastByDay.some((d) => d.tickets > 0 || d.gtv > 0 || d.orders > 0),
  };

  // Day-of-week stats
  const dayOfWeekStats: DayOfWeekStat[] = DAY_LABELS.map((label, i) => {
    const hasActual = daysWithDataSet.has(i);
    return {
      dayLabel: label,
      dayIndex: i,
      actualTickets: hasActual ? currentDayTotals[i].tickets : null,
      actualGtv: hasActual ? currentDayTotals[i].gtv : null,
      baselineTickets: baselineAvgByDay[i].tickets,
      baselineGtv: baselineAvgByDay[i].gtv,
      hasActualData: hasActual,
    };
  });

  // Best/worst baseline day by GTV
  let bestBaselineDay: { dayLabel: string; gtv: number } | null = null;
  let worstBaselineDay: { dayLabel: string; gtv: number } | null = null;
  for (const d of dayOfWeekStats) {
    if (!bestBaselineDay || d.baselineGtv > bestBaselineDay.gtv) {
      bestBaselineDay = { dayLabel: d.dayLabel, gtv: d.baselineGtv };
    }
    if (!worstBaselineDay || d.baselineGtv < worstBaselineDay.gtv) {
      worstBaselineDay = { dayLabel: d.dayLabel, gtv: d.baselineGtv };
    }
  }

  return {
    daysWithData,
    daysRemaining,
    actualsThroughToday,
    paceProjection,
    commercialForecast,
    dayOfWeekStats,
    bestBaselineDay,
    worstBaselineDay,
  };
}
