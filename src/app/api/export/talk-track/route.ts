import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateTalkTrack } from '@/lib/ai/talk-track';
import { successResponse, errorResponse } from '@/lib/utils/api';
import type { WeekData } from '@/lib/ai/narrative';
import type { SportBreakdown, TopEvent } from '@/lib/ai/talk-track';

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
      .eq('source', 'reconciled')
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
      .eq('source', 'reconciled')
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

    const talkTrack = await generateTalkTrack(
      currentWeek,
      previousWeek,
      sportBreakdown,
      topEvents
    );

    return successResponse({ talkTrack });
  } catch (error) {
    console.error('Talk track generation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to generate talk track',
      'GENERATION_ERROR',
      500
    );
  }
}
