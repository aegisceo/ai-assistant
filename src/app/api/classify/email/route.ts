/**
 * Email Classification API Route
 * POST /api/classify/email
 * 
 * Classifies a single email using Claude AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createEmailClassifier } from '@/agents/email-classifier';
import { Email, UserPreferences } from '@/types';
import { z } from 'zod';

// Request validation schema
const classifyEmailSchema = z.object({
  email: z.object({
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
  }),
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
    const validationResult = classifyEmailSchema.safeParse(body);

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

    const { email: emailData, userPreferences } = validationResult.data;

    // Convert email data to Email type
    const email: Email = {
      ...emailData,
      date: new Date(emailData.date),
      recipients: emailData.recipients as ReadonlyArray<typeof emailData.recipients[number]>,
      labels: emailData.labels as ReadonlyArray<string>,
    };

    // Get user preferences from database if not provided
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
      // Fetch from database
      const { data: dbPreferences, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (preferencesError || !dbPreferences) {
        // Use default preferences
        preferences = {
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
      } else {
        preferences = {
          emailClassificationEnabled: dbPreferences.email_classification_enabled ?? true,
          autoUnsubscribeEnabled: dbPreferences.auto_unsubscribe_enabled ?? false,
          priorityCategories: (dbPreferences.priority_categories ?? ['work', 'financial']) as readonly string[] as readonly ('work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other')[],
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
        };
      }
    }

    // Check if classification is enabled
    if (!preferences.emailClassificationEnabled) {
      return NextResponse.json(
        { success: false, error: 'Email classification is disabled in user preferences' },
        { status: 403 }
      );
    }

    // Perform classification
    const classifier = createEmailClassifier();
    const classificationResult = await classifier.classifyEmail({
      email,
      context: {
        userPreferences: preferences,
      },
    });

    if (!classificationResult.success) {
      console.error('Classification failed:', classificationResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to classify email',
          details: classificationResult.error.message,
        },
        { status: 500 }
      );
    }

    // Store classification in database
    const classification = classificationResult.data;
    const { error: storeError } = await supabase
      .from('emails')
      .upsert({
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
      }, {
        onConflict: 'user_id,gmail_id'
      });

    if (storeError) {
      console.error('Failed to store classification:', storeError);
      // Continue anyway - classification was successful
    }

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });

  } catch (error) {
    console.error('Email classification API error:', error);
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

export interface ClassifyEmailResponse {
  readonly success: boolean;
  readonly data?: {
    readonly classification: {
      readonly urgency: 1 | 2 | 3 | 4 | 5;
      readonly importance: 1 | 2 | 3 | 4 | 5;
      readonly actionRequired: boolean;
      readonly category: string;
      readonly confidence: number;
      readonly reasoning: string;
    };
    readonly suggestions: readonly string[];
    readonly metadata: {
      readonly processingTimeMs: number;
      readonly tokensUsed: number;
      readonly confidenceBreakdown: {
        readonly urgency_confidence: number;
        readonly importance_confidence: number;
        readonly category_confidence: number;
        readonly action_confidence: number;
      };
    };
  };
  readonly error?: string;
  readonly details?: unknown;
}