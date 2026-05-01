import { NextResponse } from 'next/server';

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function errorResponse(message: string, code: string, status = 500) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}
