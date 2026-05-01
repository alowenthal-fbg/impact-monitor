-- Impact Monitor Database Schema
-- Apply with: psql or Supabase SQL Editor

-- daily_metrics: one row per date per event per source
CREATE TABLE daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  tickets_sold INT,
  orders INT,
  gtv NUMERIC(12,2),
  face_value NUMERIC(12,2),
  gross_profit NUMERIC(12,2),
  sport TEXT,
  event_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('tm_api', 'snowflake', 'reconciled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(metric_date, event_name, source)
);

-- pipeline_runs: one row per pipeline execution
CREATE TABLE pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT now(),
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_message TEXT,
  completed_at TIMESTAMPTZ
);

-- subscribers: email list for Monday delivery
CREATE TABLE subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- weekly_summary: aggregates daily_metrics by Mon-Sun week
CREATE VIEW weekly_summary AS
SELECT
  date_trunc('week', metric_date + INTERVAL '1 day') - INTERVAL '1 day' AS week_start,
  SUM(tickets_sold) AS total_tickets,
  SUM(orders) AS total_orders,
  SUM(gtv) AS total_gtv,
  SUM(face_value) AS total_face_value,
  SUM(gross_profit) AS total_gross_profit
FROM daily_metrics
WHERE source = 'reconciled'
GROUP BY week_start
ORDER BY week_start DESC;

-- Row Level Security
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Anon key: read-only access
CREATE POLICY "anon_read_daily_metrics" ON daily_metrics
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_pipeline_runs" ON pipeline_runs
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_subscribers" ON subscribers
  FOR SELECT TO anon USING (true);

-- Service role: full access (bypasses RLS by default, but explicit policies for clarity)
CREATE POLICY "service_all_daily_metrics" ON daily_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_pipeline_runs" ON pipeline_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_subscribers" ON subscribers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
