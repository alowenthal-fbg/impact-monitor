# Story 2.3: Top Events Table & Pipeline Status

Status: review

## Story

As a user, I want to see top-performing events and pipeline status, so that I can identify marquee events and trust data is current.

## Acceptance Criteria

1. **Table shows top 5 events by GTV**
   - Displays sport, event name, and dollar amount for each event
   - Ranked by GTV (highest first)
   - Updates when user switches to a different week

2. **Pipeline status indicator shows last run result with timestamp**
   - Displays most recent pipeline run: success, partial, or failed
   - Includes timestamp of last successful run
   - Clear message on failure indicating what went wrong

## Tasks / Subtasks

### Task 1: Create use-top-events hook
- [x] Create `src/hooks/use-top-events.ts`
- [x] TanStack Query hook querying `daily_metrics` table
- [x] Accept `weekStart` and `weekEnd` parameters
- [x] Query rows for selected week date range
- [x] Group by event_name and sport
- [x] Aggregate SUM(gtv) per event
- [x] Order by total GTV descending, LIMIT 5
- [x] Return loading, error, data states
- [x] Cache with week-based query keys

### Task 2: Create use-pipeline-status hook
- [x] Create `src/hooks/use-pipeline-status.ts`
- [x] TanStack Query hook querying `pipeline_runs` table
- [x] Query most recent run: ORDER BY created_at DESC LIMIT 1
- [x] Return run status (success, partial, failed), timestamp, error message
- [x] Set up polling or shorter staleTime for real-time updates
- [x] Return loading, error, data states

### Task 3: Build Top Events Table component
- [x] Create `src/components/top-events-table.tsx`
- [x] Accept props: events (array of { sport, event_name, gtv })
- [x] Render as HTML table or Tailwind-styled div grid
- [x] Column headers: Sport, Event, GTV
- [x] Format GTV as currency with commas and $ prefix
- [x] Display "No events" message if data is empty
- [x] Loading state: skeleton rows (5 placeholder rows with animate-pulse)
- [x] Responsive design (stack on mobile if needed)

### Task 4: Build Pipeline Status component
- [x] Create `src/components/pipeline-status.tsx`
- [x] Accept props: status (success, partial, failed), timestamp, errorMessage
- [x] Success: green indicator with checkmark, timestamp
- [x] Partial: yellow indicator with warning icon, timestamp, partial message
- [x] Failed: red indicator with X icon, timestamp, error message
- [x] Format timestamp as relative time ("2 hours ago") using date-fns
- [x] Loading state: skeleton placeholder
- [x] Clear visual hierarchy (status badge, time, optional message)

### Task 5: Integrate Top Events Table into Dashboard page
- [x] Update `src/app/page.tsx`
- [x] Import TopEventsTable component
- [x] Import use-top-events hook with selectedWeek parameters
- [x] Pass events data to TopEventsTable
- [x] Position table below sport breakdown charts or in separate section
- [x] Handle loading and error states

### Task 6: Integrate Pipeline Status into Dashboard page
- [x] Update `src/app/page.tsx`
- [x] Import PipelineStatus component
- [x] Import use-pipeline-status hook
- [x] Pass pipeline run data to PipelineStatus
- [x] Position status indicator prominently (top of dashboard or header)
- [x] Handle loading and error states

### Task 7: Style and layout optimization
- [x] Ensure top events table is readable and well-formatted
- [x] Ensure pipeline status is visible but not intrusive
- [x] Add section headers ("Top Events This Week", "Data Pipeline Status")
- [x] Use consistent spacing and Tailwind utility classes
- [x] Test responsive behavior on mobile and desktop

### Task 8: Test functionality and data accuracy
- [x] Verify top events table shows correct top 5 by GTV
- [x] Verify table updates when week changes
- [x] Verify pipeline status displays correct run result
- [x] Test success, partial, and failed status displays
- [x] Test loading states for both components
- [x] Test error handling (no data, query failures)
- [x] Verify timestamp formatting is user-friendly

## Dev Notes

### Project Structure Notes

```
src/
├── app/
│   └── page.tsx                        # Dashboard with all components
├── components/
│   ├── kpi-card.tsx                    # (from Story 2.1)
│   ├── week-selector.tsx               # (from Story 2.1)
│   ├── weekly-trend-chart.tsx          # (from Story 2.2)
│   ├── sport-breakdown.tsx             # (from Story 2.2)
│   ├── top-events-table.tsx            # NEW: Top 5 events table
│   └── pipeline-status.tsx             # NEW: Pipeline run status
├── hooks/
│   ├── use-weekly-data.ts              # (from Story 2.1)
│   ├── use-daily-data.ts               # (from Story 2.2)
│   ├── use-trend-data.ts               # (from Story 2.2)
│   ├── use-top-events.ts               # NEW: Top events query
│   └── use-pipeline-status.ts          # NEW: Pipeline status query
└── lib/
    └── (existing from Story 2.1)
```

### References

- **Supabase Aggregations**: https://supabase.com/docs/guides/database/aggregate-functions
- **date-fns formatDistanceToNow**: https://date-fns.org/docs/formatDistanceToNow
- **Tailwind Tables**: https://tailwindcss.com/docs/table-layout
- **Epic 2 Story 2.3 in epics.md**: Lines 370-392

### Key Implementation Details

**Top Events Query:**
```typescript
// src/hooks/use-top-events.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['top-events', weekStart, weekEnd],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('sport, event_name, gtv')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEnd);

    if (error) throw error;

    // Group by event_name and sport, sum GTV
    const eventMap = data.reduce((acc, row) => {
      const key = `${row.sport}::${row.event_name}`;
      if (!acc[key]) {
        acc[key] = {
          sport: row.sport,
          event_name: row.event_name,
          gtv: 0,
        };
      }
      acc[key].gtv += row.gtv || 0;
      return acc;
    }, {});

    // Sort by GTV descending, take top 5
    return Object.values(eventMap)
      .sort((a, b) => b.gtv - a.gtv)
      .slice(0, 5);
  },
});
```

**Pipeline Status Query:**
```typescript
// src/hooks/use-pipeline-status.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['pipeline-status'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('status, created_at, error_message')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  },
  staleTime: 60 * 1000, // 1 minute (fresher than other queries)
  refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
});
```

**Top Events Table Component:**
```typescript
// src/components/top-events-table.tsx
interface TopEventsTableProps {
  events: Array<{ sport: string; event_name: string; gtv: number }>;
  isLoading?: boolean;
}

export function TopEventsTable({ events, isLoading }: TopEventsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return <p className="text-gray-500">No events found for this week.</p>;
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Sport
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Event
          </th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
            GTV
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {events.map((event, idx) => (
          <tr key={idx}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {event.sport}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">{event.event_name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
              ${event.gtv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Pipeline Status Component:**
```typescript
// src/components/pipeline-status.tsx
import { formatDistanceToNow } from 'date-fns';

interface PipelineStatusProps {
  status: 'success' | 'partial' | 'failed';
  timestamp: string;
  errorMessage?: string;
  isLoading?: boolean;
}

export function PipelineStatus({ status, timestamp, errorMessage, isLoading }: PipelineStatusProps) {
  if (isLoading) {
    return <div className="h-16 bg-gray-200 animate-pulse rounded" />;
  }

  const statusConfig = {
    success: {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '✓',
      label: 'Success',
    },
    partial: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⚠',
      label: 'Partial',
    },
    failed: {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: '✕',
      label: 'Failed',
    },
  };

  const config = statusConfig[status];
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <div className={`border rounded-lg p-4 ${config.color}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <p className="font-semibold">{config.label}</p>
          <p className="text-sm">Last run: {timeAgo}</p>
          {errorMessage && (
            <p className="text-sm mt-1">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Dashboard Integration:**
```tsx
// src/app/page.tsx
export default function DashboardPage() {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const { weekStart, weekEnd } = useMemo(() => ({
    weekStart: getWeekStart(selectedWeek),
    weekEnd: getWeekEnd(selectedWeek),
  }), [selectedWeek]);

  const { data: topEvents, isLoading: eventsLoading } = useTopEvents(weekStart, weekEnd);
  const { data: pipelineStatus, isLoading: statusLoading } = usePipelineStatus();

  return (
    <div className="container mx-auto p-6">
      {/* Pipeline Status at top */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Data Pipeline Status</h2>
        <PipelineStatus
          status={pipelineStatus?.status}
          timestamp={pipelineStatus?.created_at}
          errorMessage={pipelineStatus?.error_message}
          isLoading={statusLoading}
        />
      </div>

      {/* Week Selector */}
      <WeekSelector selectedWeek={selectedWeek} onChange={setSelectedWeek} />

      {/* KPI Cards */}
      {/* ... existing KPI cards ... */}

      {/* Charts */}
      {/* ... existing charts ... */}

      {/* Top Events Table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Top Events This Week</h2>
        <TopEventsTable events={topEvents} isLoading={eventsLoading} />
      </div>
    </div>
  );
}
```

**Database Schema Reference:**
- `daily_metrics`: metric_date, sport, event_name, gtv, tickets_purchased, orders, face_value, gross_profit, source
- `pipeline_runs`: id, status (success/partial/failed), created_at, error_message, details

**Performance Considerations:**
- Top events query aggregates in-memory (JavaScript) rather than Postgres aggregation (no GROUP BY in Supabase JS client by default)
- For large datasets, consider creating a materialized view or moving aggregation to a Postgres function
- Pipeline status polls every 5 minutes for freshness without overwhelming the server

**Error Handling:**
- Top events: show "No events" message if query returns empty
- Pipeline status: show error state if query fails, with retry button
- Both components handle loading states with skeletons

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 88 tests passing (13 test files)
- ESLint clean on all new/modified files

### Completion Notes List
- [x] use-top-events hook implemented and tested
- [x] use-pipeline-status hook implemented and tested
- [x] TopEventsTable component rendering correctly
- [x] PipelineStatus component rendering all states
- [x] Top events table shows correct top 5 by GTV
- [x] Table updates when week changes (reactive to weekStart/weekEnd params)
- [x] Pipeline status displays correct run result
- [x] Success/partial/failed states display correctly
- [x] Timestamp formatting is user-friendly (date-fns formatDistanceToNow)
- [x] Loading states working (skeletons)
- [x] Error handling working for both components
- [x] Components integrated into dashboard page
- [x] Responsive design working on mobile and desktop

### File List
- src/app/page.tsx (updated - added imports and integration)
- src/components/top-events-table.tsx (new)
- src/components/top-events-table.test.tsx (new)
- src/components/pipeline-status.tsx (new)
- src/components/pipeline-status.test.tsx (new)
- src/hooks/use-top-events.ts (new)
- src/hooks/use-top-events.test.ts (new)
- src/hooks/use-pipeline-status.ts (new)
- src/hooks/use-pipeline-status.test.ts (new)
