'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1GipSnWcjPZJFNe9U5sfhdBeZJJZk7_Y1h0LUZYaZ9D4/edit?gid=1862022446#gid=1862022446';

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchLastUpdated();
  }, []);

  async function fetchLastUpdated() {
    const supabase = createClient();
    const { data } = await supabase
      .from('forecast_metrics')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLastUpdated(data[0].updated_at);
    }
  }

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [dark]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const text = await file.text();
      const rows = parseForecastCsv(text);

      if (rows.length === 0) {
        setUploadStatus({ message: 'No forecast data found in file', error: true });
        return;
      }

      const supabase = createClient();

      // Upsert in batches
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from('forecast_metrics')
          .upsert(batch, { onConflict: 'metric_date,source' });

        if (error) throw new Error(error.message);
      }

      setUploadStatus({ message: `Uploaded ${rows.length} forecast days` });
      fetchLastUpdated();
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
      queryClient.invalidateQueries({ queryKey: ['week-pace'] });
    } catch (err) {
      setUploadStatus({
        message: err instanceof Error ? err.message : 'Upload failed',
        error: true,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [queryClient]);

  return (
    <>
      {/* Settings cog button */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Settings"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Theme toggle */}
          <div className="mb-8">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mounted && dark ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mounted && dark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Forecast upload */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Commercial Forecast
            </h3>
            {lastUpdated && (
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Last updated: {new Date(lastUpdated).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}

            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors ${
                uploading
                  ? 'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800'
                  : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-950'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload Daily Ticketing CSV'}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>

            {uploadStatus && (
              <p className={`mt-2 text-xs ${uploadStatus.error ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {uploadStatus.message}
              </p>
            )}

            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Open source spreadsheet (Daily Ticketing tab) →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

interface ForecastMetricRow {
  metric_date: string;
  tickets_sold: number;
  orders: number;
  gtv: number;
  source: 'gsheet_forecast';
}

function parseForecastCsv(text: string): ForecastMetricRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 8) return [];

  // The CSV from Google Sheets "Daily Ticketing" tab is transposed:
  // Row 1: empty (or header)
  // Row 2: indicator row (a/f)
  // Row 3: dates
  // Row 6: Ticketing Transactions
  // Row 8: Total Tickets Sold
  // Row 15: Total Ticketing GOV
  // First two columns are labels, data starts at column index 2

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { fields.push(current); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current);
    return fields;
  };

  const rows = lines.map(parseRow);

  // Find relevant rows by label (column B, index 1)
  let indicatorRow: string[] = [];
  let dateRow: string[] = [];
  let transactionsRow: string[] = [];
  let ticketsRow: string[] = [];
  let govRow: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const label = (rows[i][1] ?? '').trim().toLowerCase();
    // Indicator row has "a" or "f" in data columns
    if (i < 5 && rows[i].slice(2).some((v) => v.trim().toLowerCase() === 'a' || v.trim().toLowerCase() === 'f')) {
      indicatorRow = rows[i];
    }
    // Date row has date-like values (M/D/YYYY)
    if (!dateRow.length && rows[i].slice(2).some((v) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v.trim()))) {
      dateRow = rows[i];
    }
    if (label === 'ticketing transactions') transactionsRow = rows[i];
    if (label === 'total tickets sold') ticketsRow = rows[i];
    if (label === 'total ticketing gov') govRow = rows[i];
  }

  if (!dateRow.length || !ticketsRow.length) return [];

  const results: ForecastMetricRow[] = [];

  for (let col = 2; col < dateRow.length; col++) {
    const dateStr = dateRow[col]?.trim();
    if (!dateStr) continue;

    const metricDate = parseSheetDate(dateStr);
    if (!metricDate) continue;

    const tickets = parseNum(ticketsRow[col]);
    const orders = parseNum(transactionsRow[col]);
    const gtv = parseNumDecimal(govRow[col]);

    if (tickets === 0 && orders === 0 && gtv === 0) continue;

    results.push({
      metric_date: metricDate,
      tickets_sold: tickets,
      orders,
      gtv,
      source: 'gsheet_forecast',
    });
  }

  return results;
}

function parseSheetDate(dateStr: string): string | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

function parseNum(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s"()]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseNumDecimal(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s"()]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
