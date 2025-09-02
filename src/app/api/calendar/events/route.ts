/**
 * Calendar Events API Route
 * GET /api/calendar/events - List calendar events
 * POST /api/calendar/events - Create new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGoogleCalendarClient } from '@/integrations/calendar/google-calendar';
import { createGmailAuthService } from '@/integrations/gmail';
import { z } from 'zod';

// Validation schemas
const listEventsSchema = z.object({
  timeMin: z.string().datetime().nullable().optional(),
  timeMax: z.string().datetime().nullable().optional(),
  maxResults: z.coerce.number().min(1).max(500).optional().default(50),
  calendarId: z.string().nullable().optional().default('primary'),
  query: z.string().nullable().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  calendarId: z.string().optional().default('primary'),
});

/**
 * GET /api/calendar/events - List upcoming events
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = listEventsSchema.safeParse(queryParams);
    
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

    // Get Gmail/Google tokens (Calendar uses same OAuth scope)
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success || !tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Google Calendar not connected. Please authenticate Gmail first.' },
        { status: 403 }
      );
    }

    // Create calendar client
    const calendarClient = createGoogleCalendarClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    calendarClient.setCredentials(tokensResult.data);

    // Check if token refresh is needed
    if (authService.isTokenExpired(tokensResult.data)) {
      const refreshResult = await calendarClient.refreshTokenIfNeeded();
      if (!refreshResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh Google access token' },
          { status: 401 }
        );
      }
    }

    // List calendar events
    const listOptions: Parameters<typeof calendarClient.listEvents>[0] = {
      maxResults: params.maxResults,
      ...(params.calendarId && { calendarId: params.calendarId }),
      ...(params.timeMin && { timeMin: new Date(params.timeMin) }),
      ...(params.timeMax && { timeMax: new Date(params.timeMax) }),
      ...(params.query && { query: params.query }),
    };

    const eventsResult = await calendarClient.listEvents(listOptions);

    if (!eventsResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch calendar events',
          details: eventsResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: eventsResult.data,
    });

  } catch (error) {
    console.error('Calendar events API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/events - Create new calendar event
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = createEventSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const eventData = validationResult.data;

    // Validate date range
    const startDate = new Date(eventData.start);
    const endDate = new Date(eventData.end);

    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Get authenticated user from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Google tokens
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success || !tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Google Calendar not connected' },
        { status: 403 }
      );
    }

    // Create calendar client
    const calendarClient = createGoogleCalendarClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    calendarClient.setCredentials(tokensResult.data);

    // Check token refresh
    if (authService.isTokenExpired(tokensResult.data)) {
      const refreshResult = await calendarClient.refreshTokenIfNeeded();
      if (!refreshResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh Google access token' },
          { status: 401 }
        );
      }
    }

    // Create the event
    const createEventData: Parameters<typeof calendarClient.createEvent>[0] = {
      title: eventData.title,
      start: startDate,
      end: endDate,
      calendarId: eventData.calendarId,
      ...(eventData.description && { description: eventData.description }),
      ...(eventData.location && { location: eventData.location }),
      ...(eventData.attendees && eventData.attendees.length > 0 && { attendees: eventData.attendees }),
    };

    const createResult = await calendarClient.createEvent(createEventData);

    if (!createResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create calendar event',
          details: createResult.error.message,
        },
        { status: 500 }
      );
    }

    // Log the event creation
    await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        google_event_id: createResult.data.id,
        title: createResult.data.title,
        start_time: createResult.data.start.toISOString(),
        end_time: createResult.data.end.toISOString(),
        location: createResult.data.location || null,
        attendees_count: createResult.data.attendees.length,
        created_at: new Date().toISOString(),
      })
      .then(() => {
        // Event logged successfully
      });
      // Note: Ignoring potential logging errors to not break event creation

    return NextResponse.json({
      success: true,
      data: createResult.data,
    });

  } catch (error) {
    console.error('Create calendar event API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export interface CalendarEventsResponse {
  readonly success: boolean;
  readonly data?: {
    readonly events: ReadonlyArray<{
      readonly id: string;
      readonly title: string;
      readonly start: Date;
      readonly end: Date;
      readonly description?: string;
      readonly location?: string;
      readonly attendees: ReadonlyArray<{
        readonly email: string;
        readonly name?: string;
        readonly responseStatus: 'accepted' | 'declined' | 'needsAction' | 'tentative';
      }>;
      readonly isAllDay: boolean;
      readonly status: 'confirmed' | 'tentative' | 'cancelled';
    }>;
    readonly nextPageToken?: string;
  };
  readonly error?: string;
  readonly details?: unknown;
}