import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transformOrders, parseCsv, parseCsvLine, type ImpactOrder } from './ticketmaster';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock supabase server client
const mockUpsert = vi.fn();
vi.mock('../supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({ upsert: mockUpsert }),
  }),
}));

// Set env vars
vi.stubEnv('TM_ACCOUNT_SID', 'test-sid');
vi.stubEnv('TM_AUTH_TOKEN', 'test-token');

const sampleCsv = [
  'Month,Action_Date,Campaign,Action_Id,transaction_id,event_id,event_code,venue_id,Orders,Tickets,Category,sub_category,sub_category_level2,Status,Face,Commission,Original_GTV,GTV,VAT,Rate,Currency,currency_exch_rate,mp_exch_rate,Client_Cost,Discount,promo_voucher_code,Action_Tracker,AT_Id,Referring_URL,primary_artist_name,secondary_artist_name,venue_name,venue_city,venue_state_code,customer_country,customer_region,customer_city,event_date,onsale_date,originating_website,event_name,Subid1,Subid2,Subid3,Shared_Id',
  '202604,2026-04-30T23:27:59-0400,Ticketmaster,4272.6694.1721030,txn1,Z7r9jZ1A7Q88a,R,2078,1,3,Sports,Baseball,,Pending,444.00,64.38,538.96,538.96,0.00,0.145,USD,,,,55.5,,API Resale Purchase,9621,,Milwaukee Brewers,Chicago Cubs,American Family Field,Milwaukee,Wisconsin,US,Virginia,Ashburn,2026-06-28,1900-01-01,Fanatics,Milwaukee Brewers vs. Chicago Cubs,922292,Lifestyle Web API - Mobile,PROD,abc123',
  '202604,2026-04-30T22:48:14-0400,Ticketmaster,4272.6694.1652452,txn2,010064739A2CC84C,R,8337,1,2,Sports,Basketball,,Pending,320.00,46.40,360.00,360.00,0.00,0.145,USD,,,,40,,API Resale Purchase,9621,,Boston Celtics,Philadelphia 76ers,TD Garden,Boston,Massachusetts,US,Virginia,Ashburn,2026-05-02,2026-03-29,Fanatics,East Conf Qtrs: 76ers at Celtics Rd 1 Hm Gm 4,922259,Lifestyle Web API - Mobile,PROD,def456',
  '202604,2026-04-29T10:00:00-0400,Ticketmaster,4272.6694.1652453,txn3,Z7r9jZ1A7Q88a,R,2078,1,4,Sports,Baseball,,Pending,200.00,30.00,250.00,250.00,0.00,0.145,USD,,,,25,,API Resale Purchase,9621,,Milwaukee Brewers,Chicago Cubs,American Family Field,Milwaukee,Wisconsin,US,Virginia,Ashburn,2026-06-28,1900-01-01,Fanatics,Milwaukee Brewers vs. Chicago Cubs,922292,Lifestyle Web API - Mobile,PROD,ghi789',
].join('\n');

const sampleOrders: ImpactOrder[] = [
  {
    actionDate: '2026-04-30T23:27:59-0400',
    eventName: 'Milwaukee Brewers vs. Chicago Cubs',
    category: 'Sports',
    orders: 1,
    tickets: 3,
    gtv: 538.96,
    face: 444.0,
    commission: 64.38,
  },
  {
    actionDate: '2026-04-30T22:48:14-0400',
    eventName: 'East Conf Qtrs: 76ers at Celtics Rd 1 Hm Gm 4',
    category: 'Sports',
    orders: 1,
    tickets: 2,
    gtv: 360.0,
    face: 320.0,
    commission: 46.4,
  },
  {
    actionDate: '2026-04-30T10:00:00-0400',
    eventName: 'Milwaukee Brewers vs. Chicago Cubs',
    category: 'Sports',
    orders: 1,
    tickets: 4,
    gtv: 250.0,
    face: 200.0,
    commission: 30.0,
  },
];

describe('parseCsvLine', () => {
  it('parses simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes', () => {
    expect(parseCsvLine('a,"he said ""hi""",c')).toEqual(['a', 'he said "hi"', 'c']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('parseCsv', () => {
  it('parses CSV into ImpactOrder objects', () => {
    const orders = parseCsv(sampleCsv);
    expect(orders).toHaveLength(3);

    expect(orders[0]).toMatchObject({
      eventName: 'Milwaukee Brewers vs. Chicago Cubs',
      category: 'Sports',
      tickets: 3,
      gtv: 538.96,
      face: 444.0,
    });
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCsv('Header1,Header2')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('transformOrders', () => {
  it('groups orders by date+event and aggregates', () => {
    const rows = transformOrders(sampleOrders);
    expect(rows).toHaveLength(2);

    const brewers = rows.find((r) => r.event_name === 'Milwaukee Brewers vs. Chicago Cubs');
    expect(brewers).toMatchObject({
      metric_date: '2026-04-30',
      tickets_sold: 7,
      orders: 2,
      gtv: 788.96,
      face_value: 644.0,
      sport: 'Sports',
      source: 'tm_api',
      gross_profit: null,
    });

    const celtics = rows.find((r) => r.event_name.includes('Celtics'));
    expect(celtics).toMatchObject({
      metric_date: '2026-04-30',
      tickets_sold: 2,
      orders: 1,
      gtv: 360.0,
      face_value: 320.0,
    });
  });

  it('returns empty array for no orders', () => {
    expect(transformOrders([])).toEqual([]);
  });
});

describe('pullTicketmasterData', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSubmitResponse(resultUri: string) {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          Status: 'QUEUED',
          ResultUri: resultUri,
        }),
    };
  }

  function mockJobCompleted() {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Status: 'COMPLETED' }),
    };
  }

  function mockCsvDownload(csv: string) {
    return {
      ok: true,
      status: 200,
      text: () => Promise.resolve(csv),
    };
  }

  it('submits report, polls, downloads CSV, and upserts to supabase', async () => {
    const resultUri = '/Mediapartners/test-sid/Jobs/job-123/Download.json';
    mockFetch
      .mockResolvedValueOnce(mockSubmitResponse(resultUri))
      .mockResolvedValueOnce(mockJobCompleted())
      .mockResolvedValueOnce(mockCsvDownload(sampleCsv));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-28', '2026-04-30');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [rows, options] = mockUpsert.mock.calls[0];
    expect(rows.length).toBeGreaterThan(0);
    expect(options).toEqual({ onConflict: 'metric_date,event_name,source' });
  });

  it('throws on 401 auth failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const { pullTicketmasterData } = await import('./ticketmaster');
    await expect(pullTicketmasterData('2026-04-28', '2026-04-30')).rejects.toThrow(
      'Impact auth failed'
    );
  });

  it('retries on 429 rate limit via retryWithBackoff', async () => {
    const resultUri = '/Mediapartners/test-sid/Jobs/job-456/Download.json';
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve('Rate limited') })
      .mockResolvedValueOnce(mockSubmitResponse(resultUri))
      .mockResolvedValueOnce(mockJobCompleted())
      .mockResolvedValueOnce(mockCsvDownload(sampleCsv));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-28', '2026-04-30');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', { timeout: 15000 }, async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    });

    const { pullTicketmasterData } = await import('./ticketmaster');
    await expect(pullTicketmasterData('2026-04-28', '2026-04-30')).rejects.toThrow(
      'Impact API error: 500'
    );
  });

  it('skips upsert when no orders returned', async () => {
    const resultUri = '/Mediapartners/test-sid/Jobs/job-789/Download.json';
    const headerOnly = 'Month,Action_Date,Campaign,Action_Id,transaction_id,event_id,event_code,venue_id,Orders,Tickets,Category,sub_category,sub_category_level2,Status,Face,Commission,Original_GTV,GTV,VAT,Rate,Currency,currency_exch_rate,mp_exch_rate,Client_Cost,Discount,promo_voucher_code,Action_Tracker,AT_Id,Referring_URL,primary_artist_name,secondary_artist_name,venue_name,venue_city,venue_state_code,customer_country,customer_region,customer_city,event_date,onsale_date,originating_website,event_name,Subid1,Subid2,Subid3,Shared_Id';
    mockFetch
      .mockResolvedValueOnce(mockSubmitResponse(resultUri))
      .mockResolvedValueOnce(mockJobCompleted())
      .mockResolvedValueOnce(mockCsvDownload(headerOnly));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-28', '2026-04-30');

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
