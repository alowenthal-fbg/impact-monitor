'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatWeekLabel } from '@/lib/utils/week';
import { useSportSeasonality } from '@/hooks/use-sport-seasonality';
import { TIER_ONE_EVENTS, type TierOneEvent } from '@/lib/constants/tier-one-events';
import { getWeekStart } from '@/lib/utils/week';
import { format } from 'date-fns';

const DEFAULT_SPORTS = new Set(['Baseball', 'Football', 'Basketball', 'Hockey', 'Soccer']);

const SPORT_EMOJI: Record<string, string> = {
  Baseball: '\u26BE',
  Basketball: '\uD83C\uDFC0',
  Hockey: '\uD83C\uDFD2',
  Soccer: '\u26BD',
  Football: '\uD83C\uDFC8',
  Wrestling: '\uD83E\uDD3C',
  Lacrosse: '\uD83E\uDD4D',
  Tennis: '\uD83C\uDFBE',
  Golf: '\u26F3',
  'Motorsports/Racing': '\uD83C\uDFCE\uFE0F',
  Boxing: '\uD83E\uDD4A',
  MMA: '\uD83E\uDD4A',
  Volleyball: '\uD83C\uDFD0',
  Cricket: '\uD83C\uDFCF',
  Rugby: '\uD83C\uDFC9',
};

function sportWithEmoji(sport: string): string {
  const emoji = SPORT_EMOJI[sport];
  return emoji ? `${emoji} ${sport}` : sport;
}

const SPORT_COLORS: Record<string, string> = {
  Baseball: '#005A9C',
  Basketball: '#F58426',
  Football: '#013369',
  Hockey: '#000000',
  Soccer: '#6CC24A',
  Wrestling: '#8B0000',
  Lacrosse: '#5B2C6F',
  Tennis: '#C8E600',
  Golf: '#2E8B57',
  'Motorsports/Racing': '#DC143C',
  Boxing: '#8B4513',
  MMA: '#4B0082',
  Volleyball: '#FFD700',
  Cricket: '#228B22',
  Rugby: '#556B2F',
};

function getColor(sport: string, index: number): string {
  if (SPORT_COLORS[sport]) return SPORT_COLORS[sport];
  const fallback = ['#8884d8', '#ff7300', '#82ca9d', '#ffc658', '#8dd1e1', '#d084d0', '#ffb347'];
  return fallback[index % fallback.length];
}

function formatTicketAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

/** Map tier-one events to their nearest Monday week_start for the given year */
function getEventWeekStarts(year: number, visibleSports: Set<string>): (TierOneEvent & { weekStart: string })[] {
  return TIER_ONE_EVENTS
    .filter((e) => visibleSports.has(e.sport))
    .map((e) => {
      const monday = getWeekStart(e.getDate(year));
      return { ...e, weekStart: format(monday, 'yyyy-MM-dd') };
    });
}

/** Build a lookup from week_start → list of event labels for that week */
function buildEventsByWeek(markers: (TierOneEvent & { weekStart: string })[]): Record<string, { label: string; sport: string }[]> {
  const map: Record<string, { label: string; sport: string }[]> = {};
  for (const m of markers) {
    if (!map[m.weekStart]) map[m.weekStart] = [];
    map[m.weekStart].push({ label: m.label, sport: m.sport });
  }
  return map;
}

/** Stroke-dash style per sport so overlapping lines are distinguishable */
const EVENT_DASH: Record<string, string> = {
  Football: '6 3',
  Baseball: '3 3',
  Basketball: '8 4 2 4',
  Hockey: '2 2',
  Soccer: '10 3',
};

export function SportSeasonalityChart() {
  const { data: result, isLoading } = useSportSeasonality();
  // Rank sports by total tickets
  const rankedSports = useMemo(() => {
    if (!result) return [];
    const totals: Record<string, number> = {};
    for (const sport of result.sports) {
      totals[sport] = result.data.reduce((sum, row) => sum + (Number(row[sport]) || 0), 0);
    }
    return result.sports.sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
  }, [result]);

  const [hiddenSports, setHiddenSports] = useState<Set<string>>(new Set());
  const [showEvents, setShowEvents] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (result && !initializedRef.current) {
      initializedRef.current = true;
      setHiddenSports(new Set(result.sports.filter((s) => !DEFAULT_SPORTS.has(s))));
    }
  }, [result]);

  const toggleSport = (sport: string) => {
    setHiddenSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        // Don't allow hiding all sports
        if (rankedSports.length - next.size > 1) {
          next.add(sport);
        }
      }
      return next;
    });
  };

  const visibleSports = useMemo(() => {
    return new Set(rankedSports.filter((s) => !hiddenSports.has(s)));
  }, [rankedSports, hiddenSports]);

  const eventMarkers = useMemo(() => {
    if (!showEvents) return [];
    return getEventWeekStarts(new Date().getFullYear(), visibleSports);
  }, [showEvents, visibleSports]);

  const eventsByWeek = useMemo(() => buildEventsByWeek(eventMarkers), [eventMarkers]);

  if (isLoading) {
    return <div className="h-[420px] w-full animate-pulse rounded-lg bg-gray-200" />;
  }

  if (!result || result.data.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No seasonality data available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sport Seasonality</h2>
          <p className="text-sm text-gray-500">Weekly ticket volume by sport (YTD)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowEvents((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              showEvents
                ? 'border-gray-700 bg-gray-700 text-white'
                : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            Events
          </button>
          <span className="mx-1 h-4 w-px bg-gray-300" />
          {rankedSports.map((sport, i) => (
            <button
              key={sport}
              onClick={() => toggleSport(sport)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                hiddenSports.has(sport)
                  ? 'border-gray-300 bg-white text-gray-400'
                  : 'border-transparent text-white'
              }`}
              style={
                !hiddenSports.has(sport)
                  ? { backgroundColor: getColor(sport, i) }
                  : undefined
              }
            >
              {sportWithEmoji(sport)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={result.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="week_start"
            tickFormatter={(v) => formatWeekLabel(v).split(' - ')[0]}
            fontSize={12}
          />
          <YAxis tickFormatter={formatTicketAxis} fontSize={12} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const weekKey = String(label);
              const events = eventsByWeek[weekKey];
              const sorted = [...payload].sort(
                (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
              );
              return (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  {events && events.length > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {events.map((evt) => (
                        <div
                          key={evt.label}
                          className="flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: SPORT_COLORS[evt.sport] || '#666' }}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-sm"
                            style={{ backgroundColor: SPORT_COLORS[evt.sport] || '#666' }}
                          />
                          {evt.label}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mb-2 text-xs font-medium text-gray-600">
                    {formatWeekLabel(weekKey)}
                  </p>
                  {sorted.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-gray-700">{sportWithEmoji(String(entry.name))}</span>
                      <span className="ml-auto font-medium">{Number(entry.value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          {rankedSports
            .filter((sport) => !hiddenSports.has(sport))
            .map((sport, i) => (
              <Line
                key={sport}
                type="monotone"
                dataKey={sport}
                stroke={getColor(sport, rankedSports.indexOf(sport))}
                strokeWidth={2}
                dot={false}
                name={sportWithEmoji(sport)}
              />
            ))}
          {eventMarkers.map((evt) => (
            <ReferenceLine
              key={`${evt.sport}-${evt.abbrev}`}
              x={evt.weekStart}
              stroke={SPORT_COLORS[evt.sport] || '#999'}
              strokeDasharray={EVENT_DASH[evt.sport] || '4 4'}
              strokeWidth={1.5}
              label={{
                value: evt.abbrev,
                position: 'top',
                fill: SPORT_COLORS[evt.sport] || '#999',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
