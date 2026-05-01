# Story 2.3: Top Events Table & Pipeline Status

Status: ready-for-dev

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
- [ ] Create `src/hooks/use-top-events.ts`
- [ ] TanStack Query hook querying `daily_metrics` table
- [ ] Accept `weekStart` and `weekEnd` parameters
- [ ] Query rows for selected week date range
- [ ] Group by event_name and sport
- [ ] Aggregate SUM(gtv) per event
- [ ] Order by total GTV descending, LIMIT 5
- [ ] Return loading, error, data states
- [ ] Cache with week-based query keys

### Task 2: Create use-pipeline-status hook
- [ ] Create `src/hooks/use-pipeline-status.ts`
- [ ] TanStack Query hook querying `pipeline_runs` table
- [ ] Query most recent run: ORDER BY created_at DESC LIMIT 1
- [ ] Return run status (success, partial, failed), timestamp, error message
- [ ] Set up polling or shorter staleTime for real-time updates
- [ ] Return loading, error, data states

### Task 3: Build Top Events Table component
- [ ] Create `src/components/top-events-table.tsx`
- [ ] Accept props: events (array of { sport, event_name, gtv })
- [ ] Render as HTML table or Tailwind-styled div grid
- [ ] Column headers: Sport, Event, GTV
- [ ] Format GTV as currency with commas and $ prefix
- [ ] Display "No events" message if data is empty
- [ ] Loading state: skeleton rows (5 placeholder rows with animate-pulse)
- [ ] Responsive design (stack on mobile if needed)

### Task 4: Build Pipeline Status component
- [ ] Create `src/components/pipeline-status.tsx`
- [ ] Accept props: status (success, partial, failed), timestamp, errorMessage
- [ ] Success: green indicator with checkmark, timestamp
- [ ] Partial: yellow indicator with warning icon, timestamp, partial message
- [ ] Failed: red indicator with X icon, timestamp, error message
- [ ] Format timestamp as relative time ("2 hours ago") using date-fns
- [ ] Loading state: skeleton placeholder
- [ ] Clear visual hierarchy (status badge, time, optional message)

### Task 5: Integrate Top Events Table into Dashboard page
- [ ] Update `src/app/page.tsx`
- [ ] Import TopEventsTable component
- [ ] Import use-top-events hook with selectedWeek parameters
- [ ] Pass events data to TopEventsTable
- [ ] Position table below sport breakdown charts or in separate section
- [ ] Handle loading and error states

### Task 6: Integrate Pipeline Status into Dashboard page
- [ ] Update `src/app/page.tsx`
- [ ] Import PipelineStatus component
- [ ] Import use-pipeline-status hook
- [ ] Pass pipeline run data to PipelineStatus
- [ ] Position status indicator prominently (top of dashboard or header)
- [ ] Handle loading and error states

### Task 7: Style and layout optimization
- [ ] Ensure top events table is readable and well-formatted
- [ ] Ensure pipeline status is visible but not intrusive
- [ ] Add section headers ("Top Events This Week", "Data Pipeline Status")
- [ ] Use consistent spacing and Tailwind utility classes
- [ ] Test responsive behavior on mobile and desktop

### Task 8: Test functionality and data accuracy
- [ ] Verify top events table shows correct top 5 by GTV
- [ ] Verify table updates when week changes
- [ ] Verify pipeline status displays correct run result
- [ ] Test success, partial, and failed status displays
- [ ] Test loading states for both components
- [ ] Test error handling (no data, query failures)
- [ ] Verify timestamp formatting is user-friendly

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
_To be filled by dev agent_

### Debug Log References
_To be filled by dev agent_

### Completion Notes List
_To be filled by dev agent_
- [ ] use-top-events hook implemented and tested
- [ ] use-pipeline-status hook implemented and tested
- [ ] TopEventsTable component rendering correctly
- [ ] PipelineStatus component rendering all states
- [ ] Top events table shows correct top 5 by GTV
- [ ] Table updates when week changes
- [ ] Pipeline status displays correct run result
- [ ] Success/partial/failed states display correctly
- [ ] Timestamp formatting is user-friendly
- [ ] Loading states working (skeletons)
- [ ] Error handling working for both components
- [ ] Components integrated into dashboard page
- [ ] Responsive design working on mobile and desktop

### File List
_To be filled by dev agent with absolute paths_
- src/app/page.tsx (updated)
- src/components/top-events-table.tsx
- src/components/pipeline-status.tsx
- src/hooks/use-top-events.ts
- src/hooks/use-pipeline-status.ts
