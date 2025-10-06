import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GmailClient } from '@/integrations/gmail';
import { generateSecureState } from '@/lib/crypto';

/**
 * Gmail OAuth Authorization Endpoint
 * GET /api/gmail/auth
 * 
 * Initiates Gmail OAuth flow by redirecting user to Google consent screen
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify user is authenticated from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in first' },
        { status: 401 }
      );
    }

    // Create Gmail client
    const gmailClient = new GmailClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    // Generate secure state parameter for CSRF protection
    const state = generateSecureState();
    
    // Store the state parameter associated with the user for validation
    const { error: stateError } = await (supabase as any)
      .from('oauth_states')
      .insert({
        user_id: user.id,
        state: state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        provider: 'gmail'
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Failed to initialize OAuth flow' },
        { status: 500 }
      );
    }

    // Generate OAuth URL with state parameter
    const authUrl = gmailClient.getAuthUrl(state);

    return NextResponse.json({
      success: true,
      data: { authUrl },
    });

  } catch (error) {
    console.error('Gmail auth initiation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initiate Gmail authentication' 
      },
      { status: 500 }
    );
  }
}

/**
 * Type definitions for API responses
 */
export interface GmailAuthResponse {
  readonly success: boolean;
  readonly data?: {
    readonly authUrl: string;
  };
  readonly error?: string;
}