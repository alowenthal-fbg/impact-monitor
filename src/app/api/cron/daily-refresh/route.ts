import { NextRequest } from 'next/server';
import { runFullPipeline } from '@/lib/pipeline/orchestrator';
import { successResponse, errorResponse } from '@/lib/utils/api';

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  try {
    const result = await runFullPipeline();
    return successResponse({ message: 'Pipeline completed', result });
  } catch (error) {
    console.error('Pipeline execution failed:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Pipeline execution failed',
      'PIPELINE_ERROR',
      500
    );
  }
}
