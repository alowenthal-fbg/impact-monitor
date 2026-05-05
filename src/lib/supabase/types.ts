export interface DailyMetric {
  id: string;
  metric_date: string;
  tickets_sold: number | null;
  orders: number | null;
  gtv: number | null;
  face_value: number | null;
  gross_profit: number | null;
  sport: string | null;
  event_name: string | null;
  source: 'tm_api';
  created_at: string;
}

export interface ForecastMetric {
  id: string;
  metric_date: string;
  tickets_sold: number | null;
  orders: number | null;
  gtv: number | null;
  source: 'gsheet_forecast';
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: string;
  started_at: string;
  stage: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  error_message: string | null;
  completed_at: string | null;
}

export interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

export interface WeeklySummary {
  week_start: string;
  total_tickets: number | null;
  total_orders: number | null;
  total_gtv: number | null;
  total_face_value: number | null;
  total_gross_profit: number | null;
}
