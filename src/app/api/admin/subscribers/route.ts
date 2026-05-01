import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { isValidEmail } from '@/lib/utils/validation';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return successResponse(data || []);
  } catch (error) {
    console.error('Failed to fetch subscribers:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch subscribers',
      'FETCH_ERROR',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return errorResponse('Email is required', 'MISSING_EMAIL', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return errorResponse('Invalid email format', 'INVALID_EMAIL', 400);
    }

    const supabase = createServerClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return errorResponse('Email already subscribed', 'DUPLICATE_EMAIL', 409);
    }

    const { data, error } = await supabase
      .from('subscribers')
      .insert({ email: normalizedEmail })
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (error) {
    console.error('Failed to add subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to add subscriber',
      'INSERT_ERROR',
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Subscriber ID is required', 'MISSING_ID', 400);
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return successResponse({ id });
  } catch (error) {
    console.error('Failed to delete subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete subscriber',
      'DELETE_ERROR',
      500
    );
  }
}
