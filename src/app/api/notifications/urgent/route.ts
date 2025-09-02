/**
 * Urgent Email Notifications API Route
 * GET /api/notifications/urgent
 * 
 * Checks for urgent emails and sends notifications based on user preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailClient, createGmailAuthService } from '@/integrations/gmail';
import { createClient } from '@/lib/supabase/server';
import { Email, EmailClassification, UserPreferences } from '@/types';
import { z } from 'zod';

// Notification configuration schema
const notificationCheckSchema = z.object({
  checkSince: z.string().datetime().nullable().optional(),
  includeActionRequired: z.coerce.boolean().optional().default(true),
  minUrgency: z.coerce.number().min(1).max(5).optional().default(4),
  respectWorkingHours: z.coerce.boolean().optional().default(true),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = notificationCheckSchema.safeParse(queryParams);
    
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

    // Get user preferences for notifications
    const { data: preferencesData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userPreferences: UserPreferences = preferencesData ? {
      emailClassificationEnabled: preferencesData.email_classification_enabled ?? true,
      autoUnsubscribeEnabled: preferencesData.auto_unsubscribe_enabled ?? false,
      priorityCategories: (preferencesData.priority_categories ?? ['work', 'financial']) as readonly string[] as readonly ('work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other')[],
      workingHours: preferencesData.working_hours ? {
        start: preferencesData.working_hours.start ?? '09:00',
        end: preferencesData.working_hours.end ?? '17:00',
        days: (preferencesData.working_hours.days ?? [1, 2, 3, 4, 5]) as readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      } : {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] as const,
      },
      notificationSettings: preferencesData.notification_settings ? {
        urgentEmails: preferencesData.notification_settings.urgentEmails ?? true,
        upcomingEvents: preferencesData.notification_settings.upcomingEvents ?? true,
        missedOpportunities: preferencesData.notification_settings.missedOpportunities ?? false,
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

    // Check if notifications are enabled
    if (!userPreferences.notificationSettings.urgentEmails) {
      return NextResponse.json({
        success: true,
        data: {
          notifications: [],
          summary: 'Urgent email notifications are disabled in user preferences',
          totalUrgent: 0,
          totalActionRequired: 0,
        },
      });
    }

    // Check working hours if requested
    if (params.respectWorkingHours && !isWithinWorkingHours(userPreferences.workingHours)) {
      return NextResponse.json({
        success: true,
        data: {
          notifications: [],
          summary: 'Outside working hours - urgent notifications paused',
          totalUrgent: 0,
          totalActionRequired: 0,
        },
      });
    }

    // Get Gmail access
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success || !tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Gmail not connected' },
        { status: 403 }
      );
    }

    const gmailClient = new GmailClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    gmailClient.setCredentials(tokensResult.data);

    // Check for token refresh
    if (authService.isTokenExpired(tokensResult.data)) {
      const refreshResult = await gmailClient.refreshTokenIfNeeded();
      if (!refreshResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh Gmail access token' },
          { status: 401 }
        );
      }
    }

    // Build time-based query for recent emails
    const checkSince = params.checkSince ? new Date(params.checkSince) : new Date(Date.now() - 30 * 60 * 1000); // Default: last 30 minutes
    const checkSinceSeconds = Math.floor(checkSince.getTime() / 1000);
    
    let gmailQuery = `is:unread after:${checkSinceSeconds}`;
    
    // Focus on potentially urgent emails
    gmailQuery += ' (is:important OR has:attachment OR from:noreply OR from:alert OR from:notification OR subject:urgent OR subject:action OR subject:deadline)';

    // Fetch recent emails
    const emailsResult = await gmailClient.fetchEmails({
      maxResults: 50,
      query: gmailQuery,
      labelIds: ['INBOX'] as const,
      includeSpamTrash: false,
    });

    if (!emailsResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch emails from Gmail' },
        { status: 500 }
      );
    }

    // Get classifications for these emails
    const emailIds = emailsResult.data.emails.map(email => email.id);
    const { data: classifications } = await supabase
      .from('emails')
      .select('gmail_id, classification')
      .eq('user_id', user.id)
      .in('gmail_id', emailIds);

    const classificationMap = new Map(
      (classifications || []).map(item => [item.gmail_id, item.classification])
    );

    // Filter for urgent emails and generate notifications
    const urgentNotifications: Array<{
      email: Email;
      classification?: EmailClassification;
      urgencyReason: string;
      priority: 'critical' | 'high' | 'medium';
      suggestedAction?: string;
    }> = [];

    let totalUrgent = 0;
    let totalActionRequired = 0;

    for (const email of emailsResult.data.emails) {
      const classification = classificationMap.get(email.id) as EmailClassification | undefined;
      
      // Determine urgency based on classification or heuristics
      const urgencyScore = classification?.urgency ?? estimateUrgencyFromEmail(email);
      const actionRequired = classification?.actionRequired ?? inferActionRequired(email);
      
      if (urgencyScore >= params.minUrgency) {
        totalUrgent++;
      }
      
      if (actionRequired && params.includeActionRequired) {
        totalActionRequired++;
      }

      // Create notification if urgent enough
      if (urgencyScore >= params.minUrgency || (actionRequired && params.includeActionRequired)) {
        let urgencyReason = '';
        let priority: 'critical' | 'high' | 'medium' = 'medium';
        let suggestedAction: string | undefined;

        if (classification) {
          // AI-based urgency assessment
          if (classification.urgency === 5) {
            urgencyReason = 'Critical urgency detected by AI';
            priority = 'critical';
            suggestedAction = 'Immediate response required';
          } else if (classification.urgency === 4) {
            urgencyReason = 'High urgency detected by AI';
            priority = 'high';
            suggestedAction = 'Response needed today';
          } else if (classification.actionRequired) {
            urgencyReason = 'Action required';
            priority = 'medium';
            suggestedAction = 'Review and take necessary action';
          }

          // Category-specific messaging
          if (classification.category === 'opportunity' && userPreferences.notificationSettings.missedOpportunities) {
            urgencyReason = 'Time-sensitive opportunity detected';
            priority = 'high';
            suggestedAction = 'Review opportunity details quickly';
          }
        } else {
          // Heuristic-based assessment
          urgencyReason = inferUrgencyReason(email);
          priority = urgencyScore >= 5 ? 'critical' : urgencyScore >= 4 ? 'high' : 'medium';
          suggestedAction = 'Consider classifying with AI for better insights';
        }

        const notification: any = {
          email,
          urgencyReason,
          priority,
        };
        
        if (classification) {
          notification.classification = classification;
        }
        if (suggestedAction) {
          notification.suggestedAction = suggestedAction;
        }
        
        urgentNotifications.push(notification);
      }
    }

    // Sort notifications by priority and urgency
    urgentNotifications.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, medium: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const urgencyDiff = (b.classification?.urgency ?? 0) - (a.classification?.urgency ?? 0);
      if (urgencyDiff !== 0) return urgencyDiff;
      
      return b.email.date.getTime() - a.email.date.getTime();
    });

    // Generate summary message
    let summary = `Found ${urgentNotifications.length} urgent notification${urgentNotifications.length !== 1 ? 's' : ''}`;
    if (totalActionRequired > 0) {
      summary += `, ${totalActionRequired} requiring action`;
    }

    // Log notification check for analytics
    try {
      await supabase
        .from('notification_logs')
        .insert({
          user_id: user.id,
          check_type: 'urgent_emails',
          notifications_count: urgentNotifications.length,
          total_emails_checked: emailsResult.data.emails.length,
          check_parameters: params,
          created_at: new Date().toISOString(),
        });
    } catch {
      // Ignore logging errors - they shouldn't break the notification flow
    }

    return NextResponse.json({
      success: true,
      data: {
        notifications: urgentNotifications.map(notification => ({
          id: notification.email.id,
          subject: notification.email.subject,
          sender: notification.email.sender,
          date: notification.email.date,
          snippet: notification.email.snippet.slice(0, 100),
          urgencyReason: notification.urgencyReason,
          priority: notification.priority,
          suggestedAction: notification.suggestedAction,
          classification: notification.classification,
          isUnread: !notification.email.isRead,
          hasAttachment: notification.email.labels.includes('HAS_ATTACHMENT'),
        })),
        summary,
        totalUrgent,
        totalActionRequired,
        checkPeriod: {
          since: checkSince.toISOString(),
          totalEmails: emailsResult.data.emails.length,
        },
        userSettings: {
          notificationsEnabled: userPreferences.notificationSettings.urgentEmails,
          workingHours: userPreferences.workingHours,
          respectWorkingHours: params.respectWorkingHours,
          currentlyInWorkingHours: isWithinWorkingHours(userPreferences.workingHours),
        },
      },
    });

  } catch (error) {
    console.error('Urgent notifications API error:', error);
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
 * Check if current time is within user's working hours
 */
function isWithinWorkingHours(workingHours: UserPreferences['workingHours']): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  if (!workingHours.days.includes(currentDay as 0 | 1 | 2 | 3 | 4 | 5 | 6)) {
    return false;
  }

  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);
  
  const startTimeMinutes = startHour! * 60 + startMinute!;
  const endTimeMinutes = endHour! * 60 + endMinute!;

  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
}

/**
 * Estimate urgency from email content when AI classification isn't available
 */
function estimateUrgencyFromEmail(email: Email): number {
  let urgencyScore = 1; // Base score

  // Subject line indicators
  const subject = (email.subject || '').toLowerCase();
  const urgentKeywords = [
    'urgent', 'asap', 'immediate', 'emergency', 'critical', 'deadline',
    'expires', 'expires today', 'action required', 'respond by', 'due today'
  ];

  const highPriorityKeywords = [
    'important', 'please review', 'time sensitive', 'reminder', 'follow up'
  ];

  if (urgentKeywords.some(keyword => subject.includes(keyword))) {
    urgencyScore += 3;
  } else if (highPriorityKeywords.some(keyword => subject.includes(keyword))) {
    urgencyScore += 2;
  }

  // Gmail importance markers
  if (email.isImportant) {
    urgencyScore += 2;
  }

  // Attachment presence (often indicates actionable content)
  if (email.labels.includes('HAS_ATTACHMENT')) {
    urgencyScore += 1;
  }

  // Recent timing (emails in last few hours may be more urgent)
  const hoursSinceReceived = (Date.now() - email.date.getTime()) / (1000 * 60 * 60);
  if (hoursSinceReceived < 2) {
    urgencyScore += 1;
  }

  return Math.min(urgencyScore, 5);
}

/**
 * Infer if action is required based on email content
 */
function inferActionRequired(email: Email): boolean {
  const subject = (email.subject || '').toLowerCase();
  const snippet = email.snippet.toLowerCase();
  
  const actionKeywords = [
    'action required', 'please review', 'please respond', 'please confirm',
    'rsvp', 'deadline', 'due by', 'expires', 'approval needed', 'sign',
    'complete', 'submit', 'verify', 'update', 'urgent'
  ];

  return actionKeywords.some(keyword => 
    subject.includes(keyword) || snippet.includes(keyword)
  );
}

/**
 * Generate urgency reason based on email analysis
 */
function inferUrgencyReason(email: Email): string {
  const subject = (email.subject || '').toLowerCase();
  
  if (subject.includes('urgent') || subject.includes('emergency')) {
    return 'Marked as urgent in subject line';
  }
  if (subject.includes('deadline') || subject.includes('expires')) {
    return 'Contains deadline or expiration';
  }
  if (subject.includes('action required')) {
    return 'Action required indicated in subject';
  }
  if (email.isImportant) {
    return 'Marked as important by sender';
  }
  if (email.labels.includes('HAS_ATTACHMENT')) {
    return 'Contains attachment (may require review)';
  }
  
  return 'High priority indicators detected';
}

export interface UrgentNotificationsResponse {
  readonly success: boolean;
  readonly data?: {
    readonly notifications: ReadonlyArray<{
      readonly id: string;
      readonly subject: string | null;
      readonly sender: { readonly email: string; readonly name?: string };
      readonly date: Date;
      readonly snippet: string;
      readonly urgencyReason: string;
      readonly priority: 'critical' | 'high' | 'medium';
      readonly suggestedAction?: string;
      readonly classification?: EmailClassification;
      readonly isUnread: boolean;
      readonly hasAttachment: boolean;
    }>;
    readonly summary: string;
    readonly totalUrgent: number;
    readonly totalActionRequired: number;
    readonly checkPeriod: {
      readonly since: string;
      readonly totalEmails: number;
    };
    readonly userSettings: {
      readonly notificationsEnabled: boolean;
      readonly workingHours: UserPreferences['workingHours'];
      readonly respectWorkingHours: boolean;
      readonly currentlyInWorkingHours: boolean;
    };
  };
  readonly error?: string;
  readonly details?: unknown;
}