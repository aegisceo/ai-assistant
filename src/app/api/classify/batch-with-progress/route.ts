/**
 * Batch Email Classification API Route with Real-time Progress
 * POST /api/classify/batch-with-progress
 * 
 * Classifies multiple emails in batch with real-time progress updates via Supabase Realtime
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEmailClassifier } from '@/agents/email-classifier';
import { Email, UserPreferences } from '@/types';
import { dbService } from '@/lib/database';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Request validation schema (same as regular batch)
const classifyBatchWithProgressSchema = z.object({
  emails: z.array(z.object({
    id: z.string(),
    threadId: z.string(),
    subject: z.string().nullable(),
    sender: z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }),
    recipients: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    })),
    date: z.string().datetime(),
    snippet: z.string(),
    bodyText: z.string().nullable(),
    bodyHtml: z.string().nullable(),
    isRead: z.boolean(),
    isImportant: z.boolean(),
    labels: z.array(z.string()),
  })).max(50), // Increased limit for progress tracking
  userPreferences: z.object({
    emailClassificationEnabled: z.boolean(),
    autoUnsubscribeEnabled: z.boolean(),
    priorityCategories: z.array(z.enum(['work', 'personal', 'financial', 'opportunity', 'newsletter', 'spam', 'other'])),
    workingHours: z.object({
      start: z.string(),
      end: z.string(),
      days: z.array(z.number().min(0).max(6)),
    }),
    notificationSettings: z.object({
      urgentEmails: z.boolean(),
      upcomingEvents: z.boolean(),
      missedOpportunities: z.boolean(),
    }),
  }).optional(),
}).strict();

interface ProgressUpdate {
  session_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_emails: number;
  processed_emails: number;
  successful_emails: number;
  failed_emails: number;
  current_email_index: number;
  current_email_subject: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  estimated_time_remaining_ms: number | null;
  average_processing_time_ms: number | null;
  metadata: Record<string, unknown> | null;
}

async function updateProgress(
  sessionId: string,
  userId: string,
  update: Partial<ProgressUpdate>
): Promise<void> {
  try {
    await dbService.upsertClassificationProgress({
      session_id: sessionId,
      user_id: userId,
      ...update,
    });
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionId = uuidv4();
  
  try {
    // Verify authentication
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = classifyBatchWithProgressSchema.safeParse(body);

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

    const { emails: emailsData, userPreferences } = validationResult.data;

    if (emailsData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }

    // Convert email data to Email types
    const emails: readonly Email[] = emailsData.map(emailData => ({
      ...emailData,
      date: new Date(emailData.date),
      recipients: emailData.recipients as ReadonlyArray<typeof emailData.recipients[number]>,
      labels: emailData.labels as ReadonlyArray<string>,
    }));

    // Initialize progress tracking
    const startTime = new Date().toISOString();
    await updateProgress(sessionId, user.id, {
      session_id: sessionId,
      user_id: user.id,
      status: 'pending',
      total_emails: emails.length,
      processed_emails: 0,
      successful_emails: 0,
      failed_emails: 0,
      current_email_index: 0,
      current_email_subject: null,
      started_at: startTime,
      updated_at: startTime,
      completed_at: null,
      error_message: null,
      estimated_time_remaining_ms: null,
      average_processing_time_ms: null,
      metadata: { 
        batch_size: emails.length,
        client_ip: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Return session ID immediately for real-time tracking
    const response = NextResponse.json({
      success: true,
      data: {
        sessionId,
        message: 'Batch classification started. Use the sessionId to track progress.',
        totalEmails: emails.length,
        progressEndpoint: `/api/classify/progress?sessionId=${sessionId}`,
      },
    });

    // Start async processing (don't await - let it run in background)
    processBatchWithProgress(sessionId, user.id, emails, userPreferences)
      .catch(error => {
        console.error('Batch processing failed:', error);
        updateProgress(sessionId, user.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        });
      });

    return response;

  } catch (error) {
    console.error('Batch classification API error:', error);
    
    // Update progress with error
    try {
      await updateProgress(sessionId, 'unknown', {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });
    } catch {
      // Ignore progress update errors in error handling
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      },
      { status: 500 }
    );
  }
}

async function processBatchWithProgress(
  sessionId: string,
  userId: string,
  emails: readonly Email[],
  userPreferences?: typeof classifyBatchWithProgressSchema._output.userPreferences
): Promise<void> {
  const classifier = createEmailClassifier();
  let preferences: UserPreferences;

  // Update status to running
  await updateProgress(sessionId, userId, {
    status: 'running',
    current_email_index: 0,
  });

  // Get user preferences (same logic as regular batch route)
  if (userPreferences) {
    preferences = {
      ...userPreferences,
      priorityCategories: userPreferences.priorityCategories as ReadonlyArray<typeof userPreferences.priorityCategories[number]>,
      workingHours: {
        ...userPreferences.workingHours,
        days: userPreferences.workingHours.days as ReadonlyArray<0 | 1 | 2 | 3 | 4 | 5 | 6>,
      },
    };
  } else {
    const dbPreferences = await dbService.getUserPreferences(userId);
    
    preferences = dbPreferences ?? {
      emailClassificationEnabled: true,
      autoUnsubscribeEnabled: false,
      priorityCategories: ['work', 'financial'] as const,
      workingHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] as const,
      },
      notificationSettings: {
        urgentEmails: true,
        upcomingEvents: true,
        missedOpportunities: false,
      },
    };
  }

  // Process emails one by one with progress updates
  const emailsToStore = [];
  let successfulCount = 0;
  let failedCount = 0;
  const processingTimes: number[] = [];

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (!email) {
      failedCount++;
      continue;
    }
    
    const startTime = Date.now();

    try {
      // Update progress
      const avgTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : null;
      const estimatedRemaining = avgTime ? (emails.length - i) * avgTime : null;

      await updateProgress(sessionId, userId, {
        current_email_index: i,
        current_email_subject: email.subject,
        processed_emails: i,
        successful_emails: successfulCount,
        failed_emails: failedCount,
        average_processing_time_ms: avgTime ? Math.round(avgTime) : null,
        estimated_time_remaining_ms: estimatedRemaining ? Math.round(estimatedRemaining) : null,
      });

      // Classify email
      const result = await classifier.classifyEmail({
        email,
        context: { userPreferences: preferences },
      });

      const processingTime = Date.now() - startTime;
      processingTimes.push(processingTime);

      if (result.success) {
        successfulCount++;
        const classification = result.data;
        
        emailsToStore.push({
          user_id: userId,
          gmail_id: email.id,
          subject: email.subject,
          sender_email: email.sender.email,
          sender_name: email.sender.name ?? null,
          received_at: email.date.toISOString(),
          classification: {
            urgency: classification.urgency,
            importance: classification.importance,
            actionRequired: classification.actionRequired,
            category: classification.category,
            confidence: classification.confidence,
            reasoning: classification.reasoning ?? '',
          },
          processed_at: new Date().toISOString(),
        });
      } else {
        failedCount++;
        console.error(`Classification failed for email ${email.id}:`, result.error.message);
      }

      // Add small delay to prevent API rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      failedCount++;
      console.error(`Error processing email ${email.id}:`, error);
    }
  }

  // Store successful classifications
  if (emailsToStore.length > 0) {
    try {
      await dbService.upsertEmails(emailsToStore);
    } catch (storeError) {
      console.error('Failed to store batch classifications:', storeError);
    }
  }

  // Final progress update
  await updateProgress(sessionId, userId, {
    status: 'completed',
    processed_emails: emails.length,
    successful_emails: successfulCount,
    failed_emails: failedCount,
    current_email_index: emails.length,
    current_email_subject: null,
    completed_at: new Date().toISOString(),
    estimated_time_remaining_ms: 0,
  });
}

export interface BatchWithProgressResponse {
  readonly success: boolean;
  readonly data?: {
    readonly sessionId: string;
    readonly message: string;
    readonly totalEmails: number;
    readonly progressEndpoint: string;
  };
  readonly error?: string;
  readonly details?: unknown;
  readonly sessionId?: string;
}