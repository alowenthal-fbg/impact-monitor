import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendMondayEmail } from '@/lib/email/send';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { isValidEmail } from '@/lib/utils/validation';
import { getCurrentWeekStartString } from '@/lib/utils/week';
import type { WeekData } from '@/lib/ai/narrative';

export async function POST(request: NextRequest) {
  // Session auth — proxy.ts already enforces this, but double-check for safety
  const session = request.cookies.get('session');
  if (!session || session.value !== 'authenticated') {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  try {
    const { to } = await request.json();

    if (!to) {
      return errorResponse('Recipient email (to) is required', 'MISSING_EMAIL', 400);
    }

    const normalizedEmail = String(to).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return errorResponse('Invalid email format', 'INVALID_EMAIL', 400);
    }

    const supabase = createServerClient();

    // Pull the two most recent completed weeks — exclude the in-progress
    // week so the test email matches what the real Monday send will produce.
    const { data: weekRows, error: weekError } = await supabase
      .from('weekly_summary')
      .select('*')
      .lt('week_start', getCurrentWeekStartString())
      .order('week_start', { ascending: false })
      .limit(2);

    if (weekError) {
      return errorResponse(`Failed to load weekly data: ${weekError.message}`, 'WEEK_FETCH_ERROR', 500);
    }
    if (!weekRows || weekRows.length === 0) {
      return errorResponse('No weekly data available to send', 'NO_DATA', 400);
    }

    const toWeekData = (row: typeof weekRows[0]): WeekData => ({
      weekStart: row.week_start,
      totalTickets: row.total_tickets ?? 0,
      totalOrders: row.total_orders ?? 0,
      totalGtv: row.total_gtv ?? 0,
      totalFaceValue: row.total_face_value ?? 0,
      totalGrossProfit: row.total_gross_profit ?? 0,
    });

    await sendMondayEmail(
      toWeekData(weekRows[0]),
      weekRows.length > 1 ? toWeekData(weekRows[1]) : null,
      { recipients: [normalizedEmail], testMode: true }
    );

    return successResponse({
      message: `Test email sent to ${normalizedEmail}`,
      weekStart: weekRows[0].week_start,
    });
  } catch (error) {
    console.error('Test email send failed:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to send test email',
      'SEND_ERROR',
      500
    );
  }
}
