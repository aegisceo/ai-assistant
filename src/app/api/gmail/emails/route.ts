import { NextRequest, NextResponse } from 'next/server';
import { GmailClient, createGmailAuthService } from '@/integrations/gmail';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Gmail Emails API Endpoint
 * GET /api/gmail/emails?maxResults=50&labelIds=INBOX&query=is:unread
 * 
 * Fetches emails from user's Gmail account
 */

// Validation schema for query parameters
const fetchEmailsSchema = z.object({
  maxResults: z.coerce.number().min(1).max(500).optional().default(50),
  labelIds: z.string().nullable().optional(),
  includeSpamTrash: z.coerce.boolean().optional().default(false),
  query: z.string().nullable().optional(),
  pageToken: z.string().nullable().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      maxResults: searchParams.get('maxResults'),
      labelIds: searchParams.get('labelIds'),
      includeSpamTrash: searchParams.get('includeSpamTrash'),
      query: searchParams.get('query'),
      pageToken: searchParams.get('pageToken'),
    };

    const validationResult = fetchEmailsSchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;

    // Get authenticated user from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored Gmail tokens
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve Gmail credentials' },
        { status: 500 }
      );
    }

    if (!tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Gmail not connected. Please authenticate first.' },
        { status: 403 }
      );
    }

    // Create Gmail client and set credentials
    const gmailClient = new GmailClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    gmailClient.setCredentials(tokensResult.data);

    // Check if token refresh is needed
    if (authService.isTokenExpired(tokensResult.data)) {
      const refreshResult = await gmailClient.refreshTokenIfNeeded();
      if (!refreshResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh Gmail access token' },
          { status: 401 }
        );
      }
    }

    // Fetch emails
    const fetchOptions: {
      maxResults: number;
      labelIds?: readonly string[];
      includeSpamTrash: boolean;
      query?: string;
      pageToken?: string;
    } = {
      maxResults: params.maxResults,
      includeSpamTrash: params.includeSpamTrash,
    };

    if (params.labelIds) {
      fetchOptions.labelIds = params.labelIds.split(',') as readonly string[];
    }
    if (params.query) {
      fetchOptions.query = params.query;
    }
    if (params.pageToken) {
      fetchOptions.pageToken = params.pageToken;
    }

    const emailsResult = await gmailClient.fetchEmails(fetchOptions);

    if (!emailsResult.success) {
      console.error('Failed to fetch emails:', emailsResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch emails from Gmail' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: emailsResult.data,
    });

  } catch (error) {
    console.error('Gmail emails API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Type definitions for API responses
 */
export interface GmailEmailsResponse {
  readonly success: boolean;
  readonly data?: {
    readonly emails: readonly any[]; // Email[] from types
    readonly nextPageToken?: string;
    readonly totalEstimate: number;
  };
  readonly error?: string;
  readonly details?: any;
}