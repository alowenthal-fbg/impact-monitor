import { describe, it, expect } from 'vitest';

// Test the sport aggregation logic directly
interface RawRow {
  sport: string | null;
  tickets_sold: number | null;
  gtv: number | null;
}

function aggregateSports(rows: RawRow[]) {
  const sportMap: Record<string, { sport: string; tickets: number; gtv: number }> = {};
  for (const row of rows) {
    const sport = row.sport || 'Unknown';
    if (!sportMap[sport]) {
      sportMap[sport] = { sport, tickets: 0, gtv: 0 };
    }
    sportMap[sport].tickets += row.tickets_sold || 0;
    sportMap[sport].gtv += row.gtv || 0;
  }

  const sportData = Object.values(sportMap);
  const totalTickets = sportData.reduce((sum, s) => sum + s.tickets, 0);

  return sportData
    .map((s) => ({
      ...s,
      ticketPercentage: totalTickets > 0 ? (s.tickets / totalTickets) * 100 : 0,
    }))
    .sort((a, b) => b.tickets - a.tickets);
}

describe('Sport aggregation logic', () => {
  it('aggregates multiple rows by sport', () => {
    const rows: RawRow[] = [
      { sport: 'NBA', tickets_sold: 10, gtv: 1000 },
      { sport: 'NBA', tickets_sold: 5, gtv: 500 },
      { sport: 'NHL', tickets_sold: 3, gtv: 300 },
    ];
    const result = aggregateSports(rows);
    expect(result[0]).toEqual({ sport: 'NBA', tickets: 15, gtv: 1500, ticketPercentage: expect.closeTo(83.33, 1) });
    expect(result[1]).toEqual({ sport: 'NHL', tickets: 3, gtv: 300, ticketPercentage: expect.closeTo(16.67, 1) });
  });

  it('sorts by tickets descending', () => {
    const rows: RawRow[] = [
      { sport: 'NHL', tickets_sold: 20, gtv: 2000 },
      { sport: 'NBA', tickets_sold: 50, gtv: 5000 },
    ];
    const result = aggregateSports(rows);
    expect(result[0].sport).toBe('NBA');
    expect(result[1].sport).toBe('NHL');
  });

  it('handles null values', () => {
    const rows: RawRow[] = [
      { sport: null, tickets_sold: null, gtv: null },
      { sport: 'NBA', tickets_sold: 10, gtv: 1000 },
    ];
    const result = aggregateSports(rows);
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.sport === 'Unknown')?.tickets).toBe(0);
  });

  it('returns empty array for no data', () => {
    expect(aggregateSports([])).toEqual([]);
  });

  it('calculates 0% when total tickets is 0', () => {
    const rows: RawRow[] = [{ sport: 'NBA', tickets_sold: 0, gtv: 100 }];
    const result = aggregateSports(rows);
    expect(result[0].ticketPercentage).toBe(0);
  });
});
