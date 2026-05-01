import { NextRequest } from 'next/server';
import { runFullPipeline } from '@/lib/pipeline/orchestrator';
import { successResponse, errorResponse } from '@/lib/utils/api';

export async function POST(request: NextRequest) {
  // Verify session cookie
  const session = request.cookies.get('session');
  if (!session || session.value !== 'authenticated') {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  try {
    const result = await runFullPipeline();
    return successResponse({ message: 'Manual refresh completed', result });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Manual refresh failed',
      'REFRESH_ERROR',
      500
    );
  }
}
