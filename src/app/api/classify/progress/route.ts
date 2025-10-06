/**
 * Real-time Progress Tracking API Route
 * GET /api/classify/progress?sessionId={sessionId}
 * 
 * Provides real-time updates for batch classification progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Request validation schema
const progressQuerySchema = z.object({
  sessionId: z.string().min(1).max(100),
}).strict();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const supabase = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = progressQuerySchema.safeParse(queryParams);

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

    const { sessionId } = validationResult.data;

    // Fetch progress from database
    const { data: progressData, error: progressError } = await supabase
      .from('classification_progress')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (progressError) {
      if (progressError.code === 'PGRST116') { // Not found
        return NextResponse.json(
          { success: false, error: 'Progress session not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching progress:', progressError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch progress',
          details: progressError.message,
        },
        { status: 500 }
      );
    }

    // Return progress data
    return NextResponse.json({
      success: true,
      data: {
        sessionId: progressData.session_id,
        status: progressData.status,
        totalEmails: progressData.total_emails,
        processedEmails: progressData.processed_emails,
        successfulEmails: progressData.successful_emails,
        failedEmails: progressData.failed_emails,
        currentEmailIndex: progressData.current_email_index,
        currentEmailSubject: progressData.current_email_subject,
        startedAt: progressData.started_at,
        updatedAt: progressData.updated_at,
        completedAt: progressData.completed_at,
        errorMessage: progressData.error_message,
        estimatedTimeRemainingMs: progressData.estimated_time_remaining_ms,
        averageProcessingTimeMs: progressData.average_processing_time_ms,
        metadata: progressData.metadata,
      },
    });

  } catch (error) {
    console.error('Progress tracking API error:', error);
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

export interface ProgressResponse {
  readonly success: boolean;
  readonly data?: {
    readonly sessionId: string;
    readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    readonly totalEmails: number;
    readonly processedEmails: number;
    readonly successfulEmails: number;
    readonly failedEmails: number;
    readonly currentEmailIndex: number;
    readonly currentEmailSubject: string | null;
    readonly startedAt: string;
    readonly updatedAt: string;
    readonly completedAt: string | null;
    readonly errorMessage: string | null;
    readonly estimatedTimeRemainingMs: number | null;
    readonly averageProcessingTimeMs: number | null;
    readonly metadata: Record<string, unknown> | null;
  };
  readonly error?: string;
  readonly details?: unknown;
}