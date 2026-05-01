# Story 2.2: Weekly Trend Chart & Sport Breakdowns

Status: ready-for-dev

## Story

As a user, I want to see weekly trends over time and breakdowns by sport, so that I can identify patterns and which sports drive performance.

## Acceptance Criteria

1. **Line/area chart shows tickets sold and GTV over multiple weeks**
   - Uses Recharts with axis labels, legends, tooltips
   - Selected week is visually highlighted on the chart
   - Chart displays historical trend data across multiple weeks

2. **Bar chart shows tickets by sport with counts and percentages**
   - Displays sport name, ticket count, and percentage of total
   - Clear visual hierarchy (highest volume first)

3. **Separate bar chart for GTV by sport**
   - Shows dollar amounts per sport
   - Formatted as currency with proper labels

4. **Switching weeks via selector updates sport breakdowns and trend highlight**
   - Sport breakdown charts update to reflect selected week
   - Trend chart adjusts highlighted week indicator
   - Updates render smoothly within 1 second

## Tasks / Subtasks

### Task 1: Install Recharts
- [ ] Install `recharts` package
- [ ] Review Recharts documentation for ResponsiveContainer, LineChart, AreaChart, BarChart

### Task 2: Create use-daily-data hook for sport-level detail
- [ ] Create `src/hooks/use-daily-data.ts`
- [ ] TanStack Query hook querying `daily_metrics` table
- [ ] Accept `weekStart` and `weekEnd` parameters
- [ ] Group by sport, aggregate tickets and GTV
- [ ] Calculate percentages (tickets by sport / total tickets * 100)
- [ ] Return loading, error, data states
- [ ] Cache with week-based query keys

### Task 3: Create use-trend-data hook for multi-week data
- [ ] Create `src/hooks/use-trend-data.ts`
- [ ] Query `weekly_summary` view for last 8-12 weeks
- [ ] Return array of weeks with tickets_sold and gtv
- [ ] Accept `selectedWeek` parameter for highlighting
- [ ] Cache with appropriate staleTime

### Task 4: Build Weekly Trend Chart component
- [ ] Create `src/components/weekly-trend-chart.tsx`
- [ ] Accept props: trendData, selectedWeek
- [ ] Implement ResponsiveContainer wrapping chart
- [ ] Use ComposedChart or AreaChart for dual-axis display
- [ ] Left Y-axis: tickets sold (area/line)
- [ ] Right Y-axis: GTV (line with different color)
- [ ] Highlight selected week with CustomizedDot or ReferenceLine
- [ ] Format tooltips with human-readable numbers
- [ ] Add axis labels and legend
- [ ] Loading state: skeleton placeholder

### Task 5: Build Sport Breakdown (Tickets) component
- [ ] Create `src/components/sport-breakdown.tsx`
- [ ] Accept props: sportData (sport, tickets, percentage), metric ('tickets' | 'gtv')
- [ ] Use Recharts BarChart with ResponsiveContainer
- [ ] X-axis: sport name
- [ ] Y-axis: count or dollar amount
- [ ] Show percentage labels on bars for tickets
- [ ] Format currency for GTV chart
- [ ] Sort bars by value (descending)
- [ ] Loading state: skeleton placeholder
- [ ] Responsive design

### Task 6: Build Sport Breakdown (GTV) component variant
- [ ] Reuse `src/components/sport-breakdown.tsx` with metric prop
- [ ] Conditional rendering based on metric type
- [ ] Currency formatting for GTV bars
- [ ] Percentage formatting for tickets bars
- [ ] Proper tooltips for each metric type

### Task 7: Integrate charts into Dashboard page
- [ ] Update `src/app/page.tsx`
- [ ] Import WeeklyTrendChart, SportBreakdown components
- [ ] Import use-daily-data and use-trend-data hooks
- [ ] Pass selectedWeek to both hooks
- [ ] Render trend chart with full historical data
- [ ] Render two sport breakdown charts (tickets, GTV)
- [ ] Layout charts in responsive grid (Tailwind)
- [ ] Handle loading states for all charts

### Task 8: Test chart interactions and performance
- [ ] Verify trend chart highlights selected week
- [ ] Verify sport breakdowns update on week change
- [ ] Test tooltips display correct data
- [ ] Test responsive behavior on different screen sizes
- [ ] Verify 1-second update target on week switch
- [ ] Test loading skeletons for charts
- [ ] Test error states

## Dev Notes

### Project Structure Notes

```
src/
├── app/
│   └── page.tsx                      # Dashboard with charts
├── components/
│   ├── kpi-card.tsx                  # (from Story 2.1)
│   ├── week-selector.tsx             # (from Story 2.1)
│   ├── weekly-trend-chart.tsx        # Line/area chart for trends
│   └── sport-breakdown.tsx           # Bar chart for sport data
├── hooks/
│   ├── use-weekly-data.ts            # (from Story 2.1)
│   ├── use-daily-data.ts             # Sport-level detail
│   └── use-trend-data.ts             # Multi-week trend data
└── lib/
    └── (existing from Story 2.1)
```

### References

- **Recharts Documentation**: https://recharts.org/en-US/api
- **Recharts Examples**: https://recharts.org/en-US/examples
- **Epic 2 Story 2.2 in epics.md**: Lines 346-369
- **TanStack Query caching patterns**: https://tanstack.com/query/latest/docs/framework/react/guides/caching

### Key Implementation Details

**Daily Data Query (Sport Breakdown):**
```typescript
// src/hooks/use-daily-data.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['daily-metrics', 'sport-breakdown', weekStart, weekEnd],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('sport, tickets_purchased, gtv')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEnd);

    if (error) throw error;

    // Aggregate by sport
    const sportMap = data.reduce((acc, row) => {
      if (!acc[row.sport]) {
        acc[row.sport] = { sport: row.sport, tickets: 0, gtv: 0 };
      }
      acc[row.sport].tickets += row.tickets_purchased || 0;
      acc[row.sport].gtv += row.gtv || 0;
      return acc;
    }, {});

    const sportData = Object.values(sportMap);
    const totalTickets = sportData.reduce((sum, s) => sum + s.tickets, 0);

    return sportData.map(s => ({
      ...s,
      ticketPercentage: (s.tickets / totalTickets) * 100,
    }));
  },
});
```

**Trend Data Query:**
```typescript
// src/hooks/use-trend-data.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['weekly-summary', 'trend'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('weekly_summary')
      .select('week_start, tickets_sold, gtv')
      .order('week_start', { ascending: true })
      .limit(12); // Last 12 weeks

    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Recharts Trend Chart Pattern:**
```typescript
// src/components/weekly-trend-chart.tsx
<ResponsiveContainer width="100%" height={300}>
  <ComposedChart data={trendData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
      dataKey="week_start"
      tickFormatter={(value) => formatWeekLabel(value)}
    />
    <YAxis yAxisId="left" label={{ value: 'Tickets', angle: -90 }} />
    <YAxis yAxisId="right" orientation="right" label={{ value: 'GTV ($)', angle: 90 }} />
    <Tooltip content={<CustomTooltip />} />
    <Legend />
    <Area
      yAxisId="left"
      type="monotone"
      dataKey="tickets_sold"
      fill="#8884d8"
      stroke="#8884d8"
      name="Tickets Sold"
    />
    <Line
      yAxisId="right"
      type="monotone"
      dataKey="gtv"
      stroke="#82ca9d"
      name="GTV"
      strokeWidth={2}
    />
    {selectedWeek && (
      <ReferenceLine
        x={selectedWeek}
        stroke="red"
        strokeWidth={2}
        label="Selected Week"
      />
    )}
  </ComposedChart>
</ResponsiveContainer>
```

**Recharts Bar Chart Pattern:**
```typescript
// src/components/sport-breakdown.tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={sportData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="sport" />
    <YAxis />
    <Tooltip />
    <Bar dataKey={metric === 'tickets' ? 'tickets' : 'gtv'} fill="#8884d8">
      <LabelList
        dataKey={metric === 'tickets' ? 'ticketPercentage' : 'gtv'}
        position="top"
        formatter={(value) => metric === 'tickets' ? `${value.toFixed(1)}%` : `$${(value / 1000).toFixed(1)}K`}
      />
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

**Dashboard Layout:**
```tsx
// src/app/page.tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* KPI Cards from Story 2.1 */}
  <div className="col-span-1 lg:col-span-2">
    <WeeklyTrendChart trendData={trendData} selectedWeek={selectedWeek} />
  </div>
  <div>
    <h2>Tickets by Sport</h2>
    <SportBreakdown sportData={sportData} metric="tickets" />
  </div>
  <div>
    <h2>GTV by Sport</h2>
    <SportBreakdown sportData={sportData} metric="gtv" />
  </div>
</div>
```

**Performance Considerations:**
- Use `useMemo` for sport aggregation calculations
- Recharts ResponsiveContainer lazy-loads on viewport visibility
- TanStack Query caches both daily and trend data
- Week change only refetches daily data (trend data reuses cache)

**Responsive Design:**
- Charts stack vertically on mobile (1 column)
- Side-by-side on desktop (2 columns)
- Trend chart spans full width
- Use Tailwind `lg:` breakpoint for responsive grid

## Dev Agent Record

### Agent Model Used
_To be filled by dev agent_

### Debug Log References
_To be filled by dev agent_

### Completion Notes List
_To be filled by dev agent_
- [ ] Recharts package installed
- [ ] use-daily-data hook implemented and tested
- [ ] use-trend-data hook implemented and tested
- [ ] WeeklyTrendChart component rendering correctly
- [ ] SportBreakdown component rendering both metrics
- [ ] Trend chart highlights selected week
- [ ] Sport breakdowns show percentages and currency
- [ ] Charts integrated into dashboard page
- [ ] Loading states working (skeletons)
- [ ] Week switching updates all charts smoothly
- [ ] Performance target met (1s update)
- [ ] Responsive design working on mobile and desktop
- [ ] Tooltips display correct formatted data

### File List
_To be filled by dev agent with absolute paths_
- src/app/page.tsx (updated)
- src/components/weekly-trend-chart.tsx
- src/components/sport-breakdown.tsx
- src/hooks/use-daily-data.ts
- src/hooks/use-trend-data.ts
- package.json (recharts added)
