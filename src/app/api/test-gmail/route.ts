/**
 * Test Gmail Connection (Development Only)
 * GET /api/test-gmail
 * 
 * Tests Gmail OAuth flow without Supabase authentication
 * WARNING: This bypasses authentication and should only be used in development
 */

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints not available in production' },
      { status: 403 }
    );
  }

  try {
    // For development testing without full auth
    return NextResponse.json({
      success: true,
      connected: false,
      email: null,
      scopes: [],
      message: 'Gmail authentication requires Supabase login first',
      devNote: 'Use /api/gmail/auth after implementing Supabase Auth'
    });

  } catch (error) {
    console.error('Test Gmail error:', error);
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    );
  }
}