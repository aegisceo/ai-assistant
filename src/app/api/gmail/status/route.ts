import { NextRequest, NextResponse } from 'next/server';
import { createGmailAuthService } from '@/integrations/gmail';
import { createClient } from '@/lib/supabase/server';

/**
 * Gmail Connection Status Endpoint
 * GET /api/gmail/status
 * 
 * Returns the current Gmail connection status for the authenticated user
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for stored Gmail tokens
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to check Gmail connection status' },
        { status: 500 }
      );
    }

    const isConnected = tokensResult.data !== null;
    const isExpired = tokensResult.data ? authService.isTokenExpired(tokensResult.data) : false;

    return NextResponse.json({
      success: true,
      data: {
        isConnected,
        isExpired,
        scopes: tokensResult.data?.scope.split(' ') ?? [],
        connectedAt: tokensResult.data ? new Date(tokensResult.data.expiryDate - 3600000).toISOString() : null,
        expiresAt: tokensResult.data ? new Date(tokensResult.data.expiryDate).toISOString() : null,
      },
    });

  } catch (error) {
    console.error('Gmail status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check Gmail status' },
      { status: 500 }
    );
  }
}

/**
 * Disconnect Gmail Account
 * DELETE /api/gmail/status
 * 
 * Removes stored Gmail tokens for the authenticated user
 */
export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete stored tokens
    const authService = createGmailAuthService();
    const deleteResult = await authService.deleteTokens(user.id);

    if (!deleteResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to disconnect Gmail account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Gmail account disconnected successfully' },
    });

  } catch (error) {
    console.error('Gmail disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Gmail account' },
      { status: 500 }
    );
  }
}

/**
 * Type definitions for API responses
 */
export interface GmailStatusResponse {
  readonly success: boolean;
  readonly data?: {
    readonly isConnected: boolean;
    readonly isExpired: boolean;
    readonly scopes: readonly string[];
    readonly connectedAt: string | null;
    readonly expiresAt: string | null;
  };
  readonly error?: string;
}

export interface GmailDisconnectResponse {
  readonly success: boolean;
  readonly data?: {
    readonly message: string;
  };
  readonly error?: string;
}