'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface PipelineRun {
  status: 'success' | 'partial' | 'failed';
  started_at: string;
  error_message: string | null;
}

export function usePipelineStatus() {
  return useQuery<PipelineRun>({
    queryKey: ['pipeline-status'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('status, started_at, error_message')
        .eq('stage', 'full_pipeline')
        .neq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as PipelineRun;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
