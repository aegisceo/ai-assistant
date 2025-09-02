/**
 * Batch Email Classification API Route
 * POST /api/classify/batch
 * 
 * Classifies multiple emails in batch using Claude AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createEmailClassifier } from '@/agents/email-classifier';
import { Email, UserPreferences } from '@/types';
import { z } from 'zod';

// Request validation schema
const classifyBatchSchema = z.object({
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
  })).max(20), // Limit batch size
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = classifyBatchSchema.safeParse(body);

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

    // Get user preferences (same logic as single email route)
    let preferences: UserPreferences;
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
      // Fetch from database or use defaults (same as single route)
      const { data: dbPreferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      preferences = dbPreferences ? {
        emailClassificationEnabled: dbPreferences.email_classification_enabled ?? true,
        autoUnsubscribeEnabled: dbPreferences.auto_unsubscribe_enabled ?? false,
        priorityCategories: (dbPreferences.priority_categories ?? ['work', 'financial']) as readonly ('work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other')[],
        workingHours: dbPreferences.working_hours ? {
          start: dbPreferences.working_hours.start ?? '09:00',
          end: dbPreferences.working_hours.end ?? '17:00',
          days: (dbPreferences.working_hours.days ?? [1, 2, 3, 4, 5]) as readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
        } : {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5] as const,
        },
        notificationSettings: dbPreferences.notification_settings ? {
          urgentEmails: dbPreferences.notification_settings.urgentEmails ?? true,
          upcomingEvents: dbPreferences.notification_settings.upcomingEvents ?? true,
          missedOpportunities: dbPreferences.notification_settings.missedOpportunities ?? false,
        } : {
          urgentEmails: true,
          upcomingEvents: true,
          missedOpportunities: false,
        },
      } : {
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

    // Check if classification is enabled
    if (!preferences.emailClassificationEnabled) {
      return NextResponse.json(
        { success: false, error: 'Email classification is disabled in user preferences' },
        { status: 403 }
      );
    }

    // Perform batch classification
    const classifier = createEmailClassifier();
    const requests = emails.map(email => ({
      email,
      context: { userPreferences: preferences },
    }));

    const classificationResults = await classifier.classifyEmailsBatch(requests);

    // Process results and store successful classifications
    const results = [];
    const emailsToStore = [];

    for (let i = 0; i < classificationResults.length; i++) {
      const result = classificationResults[i];
      const email = emails[i];

      if (!result || !email) continue;

      if (result.success) {
        const classification = result.data;
        
        results.push({
          emailId: email.id,
          success: true,
          classification: {
            urgency: classification.urgency,
            importance: classification.importance,
            actionRequired: classification.actionRequired,
            category: classification.category,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
          },
          suggestions: classification.suggestions,
          metadata: {
            processingTimeMs: classification.processing_time_ms,
            tokensUsed: classification.tokens_used,
            confidenceBreakdown: classification.confidence_breakdown,
          },
        });

        // Prepare for database storage
        emailsToStore.push({
          user_id: user.id,
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
            reasoning: classification.reasoning,
          },
          processed_at: new Date().toISOString(),
        });
      } else {
        results.push({
          emailId: email.id,
          success: false,
          error: result.error.message,
        });
      }
    }

    // Store successful classifications in batch
    if (emailsToStore.length > 0) {
      const { error: storeError } = await supabase
        .from('emails')
        .upsert(emailsToStore, {
          onConflict: 'user_id,gmail_id'
        });

      if (storeError) {
        console.error('Failed to store batch classifications:', storeError);
        // Continue anyway - classifications were successful
      }
    }

    // Calculate summary statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTokens = results
      .filter((r): r is typeof r & { success: true } => r.success)
      .reduce((sum, r) => sum + (r.metadata?.tokensUsed || 0), 0);
    const avgProcessingTime = results
      .filter((r): r is typeof r & { success: true } => r.success)
      .reduce((sum, r) => sum + (r.metadata?.processingTimeMs || 0), 0) / (successful || 1);

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: emails.length,
          successful,
          failed,
          totalTokensUsed: totalTokens,
          averageProcessingTimeMs: Math.round(avgProcessingTime),
        },
      },
    });

  } catch (error) {
    console.error('Batch email classification API error:', error);
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

export interface ClassifyBatchResponse {
  readonly success: boolean;
  readonly data?: {
    readonly results: ReadonlyArray<{
      readonly emailId: string;
      readonly success: boolean;
      readonly classification?: {
        readonly urgency: 1 | 2 | 3 | 4 | 5;
        readonly importance: 1 | 2 | 3 | 4 | 5;
        readonly actionRequired: boolean;
        readonly category: string;
        readonly confidence: number;
        readonly reasoning: string;
      };
      readonly suggestions?: readonly string[];
      readonly metadata?: {
        readonly processingTimeMs: number;
        readonly tokensUsed: number;
        readonly confidenceBreakdown: Record<string, number>;
      };
      readonly error?: string;
    }>;
    readonly summary: {
      readonly total: number;
      readonly successful: number;
      readonly failed: number;
      readonly totalTokensUsed: number;
      readonly averageProcessingTimeMs: number;
    };
  };
  readonly error?: string;
  readonly details?: unknown;
}