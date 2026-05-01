# Story 2.1: KPI Cards with Week-over-Week Comparison

Status: ready-for-dev

## Story

As a user, I want to see headline KPI cards showing Total Tickets Sold, Total Orders, Total GTV, and Avg Order Value with week-over-week deltas, so that I can instantly gauge performance relative to last week.

## Acceptance Criteria

1. **Four KPI cards display with current value and WoW percentage change**
   - Data fetched via TanStack Query hooks from Supabase (anon key + RLS)
   - Cards: Total Tickets Sold, Total Orders, Total Revenue/GTV, Avg Order Value
   - Each card shows positive/negative WoW delta indicator

2. **Skeleton placeholders show during loading**
   - Tailwind `animate-pulse` skeletons display in place of KPI cards
   - Full dashboard loads within 3 seconds on standard broadband

3. **Week selector allows choosing historical weeks**
   - KPI cards update within 1 second when week changes
   - Updates reflect selected week's data with WoW comparison against prior week

4. **Current (in-progress) week shows week-to-date values**
   - Display clearly indicates week is in progress
   - Shows partial week data based on available daily metrics

5. **Week selector defaults to current week with all historical weeks available**
   - Current week selected by default
   - All historical weeks with data available for selection

## Tasks / Subtasks

### Task 1: Install TanStack Query and set up QueryClientProvider
- [ ] Install `@tanstack/react-query`
- [ ] Create `src/lib/query-client.ts` with QueryClient instance
- [ ] Wrap app with QueryClientProvider in `src/app/layout.tsx`
- [ ] Configure staleTime, cacheTime for dashboard queries

### Task 2: Create Supabase browser client and types
- [ ] Create `src/lib/supabase/client.ts` with browser client (anon key)
- [ ] Create `src/lib/supabase/types.ts` with `WeeklySummary` type
  - Fields: week_start, tickets_sold, orders, gtv, face_value, gross_profit, avg_order_value
  - Include WoW delta fields: tickets_sold_wow, orders_wow, gtv_wow, avg_order_value_wow
- [ ] Add query function for `weekly_summary` view

### Task 3: Create week utilities
- [ ] Create `src/lib/utils/week.ts`
- [ ] Implement `getWeekStart(date)` using `date-fns` with `America/New_York` timezone
- [ ] Implement `getWeekEnd(date)`
- [ ] Implement `getCurrentWeek()`
- [ ] Implement `formatWeekLabel(weekStart)` for display
- [ ] Install `date-fns` and `date-fns-tz`

### Task 4: Build use-weekly-data hook
- [ ] Create `src/hooks/use-weekly-data.ts`
- [ ] Implement TanStack Query hook wrapping Supabase query
- [ ] Accept `weekStart` parameter for selected week
- [ ] Calculate WoW deltas from previous week data
- [ ] Return loading, error, data states
- [ ] Set up proper caching with week-based query keys

### Task 5: Build KPI Card component
- [ ] Create `src/components/kpi-card.tsx`
- [ ] Props: title, value, unit (tickets, orders, currency), wowDelta (percentage)
- [ ] Display value with proper formatting (commas for numbers, $ for currency)
- [ ] Show WoW delta with up/down arrow and color coding (green positive, red negative)
- [ ] Loading state: Tailwind animate-pulse skeleton
- [ ] Responsive design with Tailwind CSS

### Task 6: Build Week Selector component
- [ ] Create `src/components/week-selector.tsx`
- [ ] Query available weeks from Supabase (distinct week_start values)
- [ ] Dropdown/select showing formatted week labels
- [ ] Default to current week
- [ ] Call onChange when week selected
- [ ] Show "In Progress" badge for current week

### Task 7: Build Dashboard page
- [ ] Create/update `src/app/page.tsx`
- [ ] Import and use WeekSelector component
- [ ] Manage selected week state
- [ ] Import and use useWeeklyData hook with selected week
- [ ] Render 4 KPI cards with data from hook
- [ ] Show skeletons during loading
- [ ] Handle error states with clear messaging

### Task 8: Test performance and loading states
- [ ] Verify dashboard loads within 3 seconds
- [ ] Verify week switching updates within 1 second
- [ ] Test skeleton loading states
- [ ] Test error states (network failure, no data)
- [ ] Test current week "in progress" indicator
- [ ] Test historical week selection

## Dev Notes

### Project Structure Notes

```
src/
├── app/
│   ├── layout.tsx              # QueryClientProvider wrapper
│   └── page.tsx                # Dashboard page with KPI cards
├── components/
│   ├── kpi-card.tsx            # Presentational KPI card
│   └── week-selector.tsx       # Week dropdown selector
├── hooks/
│   └── use-weekly-data.ts      # TanStack Query hook for weekly data
└── lib/
    ├── query-client.ts         # QueryClient configuration
    ├── supabase/
    │   ├── client.ts           # Browser client (anon key)
    │   └── types.ts            # TypeScript types for DB schema
    └── utils/
        └── week.ts             # Week boundary utilities
```

### References

- **TanStack Query docs**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Supabase JS client**: https://supabase.com/docs/reference/javascript/introduction
- **date-fns**: https://date-fns.org/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Epic 2 Story 2.1 in epics.md**: Lines 312-345

### Key Implementation Details

**Supabase Query Pattern:**
```typescript
// src/hooks/use-weekly-data.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['weekly-summary', weekStart],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('week_start', weekStart)
      .single();
    if (error) throw error;
    return data;
  },
});
```

**Week Utilities:**
```typescript
// src/lib/utils/week.ts
import { startOfWeek, endOfWeek } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const TZ = 'America/New_York';

export function getWeekStart(date: Date): Date {
  const zonedDate = utcToZonedTime(date, TZ);
  const monday = startOfWeek(zonedDate, { weekStartsOn: 1 });
  return zonedTimeToUtc(monday, TZ);
}
```

**KPI Card Props:**
```typescript
interface KPICardProps {
  title: string;
  value: number;
  unit: 'tickets' | 'orders' | 'currency';
  wowDelta: number; // percentage
  isLoading?: boolean;
}
```

**Dashboard Data Flow:**
1. User selects week via WeekSelector
2. Dashboard page updates selectedWeek state
3. useWeeklyData hook refetches with new week parameter
4. TanStack Query caches results by week
5. KPI cards re-render with new data

**WoW Calculation:**
- Query current week and previous week from weekly_summary view
- Calculate percentage change: `((current - previous) / previous) * 100`
- Handle edge cases: no previous week, zero division

**Performance Optimization:**
- TanStack Query caches weekly data (staleTime: 5 minutes)
- Week selector pre-fetches next/previous weeks on hover
- Skeleton loaders prevent layout shift

## Dev Agent Record

### Agent Model Used
_To be filled by dev agent_

### Debug Log References
_To be filled by dev agent_

### Completion Notes List
_To be filled by dev agent_
- [ ] QueryClientProvider configured in layout.tsx
- [ ] Supabase client and types created
- [ ] Week utilities implemented and tested
- [ ] use-weekly-data hook working with caching
- [ ] KPI card component rendering correctly
- [ ] Week selector component functional
- [ ] Dashboard page displaying 4 KPI cards
- [ ] Loading states working (skeletons)
- [ ] WoW delta calculations accurate
- [ ] Performance targets met (3s load, 1s switch)
- [ ] Current week "in progress" indicator working
- [ ] Historical week selection working

### File List
_To be filled by dev agent with absolute paths_
- src/app/layout.tsx
- src/app/page.tsx
- src/components/kpi-card.tsx
- src/components/week-selector.tsx
- src/hooks/use-weekly-data.ts
- src/lib/query-client.ts
- src/lib/supabase/client.ts
- src/lib/supabase/types.ts
- src/lib/utils/week.ts
- package.json (dependencies added)
