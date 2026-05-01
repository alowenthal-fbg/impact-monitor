import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/api';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || password !== process.env.AUTH_PASSWORD) {
      return errorResponse('Invalid password', 'INVALID_PASSWORD', 401);
    }

    const response = successResponse({ message: 'Authenticated' });

    response.cookies.set('session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
