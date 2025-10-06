/**
 * Smart Email Filtering API Route
 * GET /api/emails/smart-filter
 * 
 * Fetches emails with AI-powered filtering and auto-prioritization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GmailClient, createGmailAuthService } from '@/integrations/gmail';
import { Email, EmailCategory, UserPreferences } from '@/types';
import { z } from 'zod';

// Validation schema for smart filter parameters
const smartFilterSchema = z.object({
  maxResults: z.coerce.number().min(1).max(500).optional().default(50),
  urgencyFilter: z.coerce.number().min(1).max(5).nullable().optional(),
  importanceFilter: z.coerce.number().min(1).max(5).nullable().optional(),
  categoryFilter: z.enum(['work', 'personal', 'financial', 'opportunity', 'newsletter', 'spam', 'other']).nullable().optional(),
  actionRequired: z.coerce.boolean().nullable().optional(),
  priorityMode: z.enum(['all', 'high_priority', 'urgent_only', 'work_hours']).nullable().optional().default('all'),
  sortBy: z.enum(['date', 'urgency', 'importance', 'priority_score']).nullable().optional().default('priority_score'),
  sortOrder: z.enum(['asc', 'desc']).nullable().optional().default('desc'),
  includeUnclassified: z.coerce.boolean().optional().default(true),
  pageToken: z.string().nullable().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = smartFilterSchema.safeParse(queryParams);
    
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

    // Get user preferences for smart filtering
    const { data: preferencesData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userPreferences: UserPreferences = preferencesData ? {
      emailClassificationEnabled: (preferencesData as any).email_classification_enabled ?? true,
      autoUnsubscribeEnabled: (preferencesData as any).auto_unsubscribe_enabled ?? false,
      priorityCategories: ((preferencesData as any).priority_categories ?? ['work', 'financial']) as readonly EmailCategory[],
      workingHours: (preferencesData as any).working_hours ? {
        start: (preferencesData as any).working_hours.start ?? '09:00',
        end: (preferencesData as any).working_hours.end ?? '17:00',
        days: ((preferencesData as any).working_hours.days ?? [1, 2, 3, 4, 5]) as readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      } : {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] as const,
      },
      notificationSettings: (preferencesData as any).notification_settings ? {
        urgentEmails: (preferencesData as any).notification_settings.urgentEmails ?? true,
        upcomingEvents: (preferencesData as any).notification_settings.upcomingEvents ?? true,
        missedOpportunities: (preferencesData as any).notification_settings.missedOpportunities ?? false,
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

    // Get Gmail tokens and client
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success || !tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Gmail not connected. Please authenticate first.' },
        { status: 403 }
      );
    }

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

    // Build Gmail query based on priority mode
    let gmailQuery = '';
    switch (params.priorityMode) {
      case 'urgent_only':
        gmailQuery = 'is:important OR has:attachment';
        break;
      case 'work_hours':
        // Filter emails received during working hours
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        if (userPreferences.workingHours.days.includes(currentDay as 0 | 1 | 2 | 3 | 4 | 5 | 6) &&
            currentHour >= parseInt(userPreferences.workingHours.start.split(':')[0]!) &&
            currentHour <= parseInt(userPreferences.workingHours.end.split(':')[0]!)) {
          gmailQuery = 'is:unread';
        } else {
          gmailQuery = 'is:important';
        }
        break;
      case 'high_priority':
        gmailQuery = 'is:unread (is:important OR from:noreply OR from:notification)';
        break;
      default:
        gmailQuery = 'is:unread';
    }

    // Fetch emails from Gmail
    const emailsResult = await gmailClient.fetchEmails({
      maxResults: params.maxResults,
      query: gmailQuery,
      labelIds: ['INBOX'] as const,
      includeSpamTrash: false,
      ...(params.pageToken && { pageToken: params.pageToken }),
    });

    if (!emailsResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch emails from Gmail' },
        { status: 500 }
      );
    }

    // Get stored classifications for these emails
    const emailIds = emailsResult.data.emails.map(email => email.id);
    const { data: classifications } = await supabase
      .from('emails')
      .select('gmail_id, classification')
      .eq('user_id', user.id)
      .in('gmail_id', emailIds);

    const classificationMap = new Map(
      (classifications || []).map((item: any) => [item.gmail_id, item.classification])
    );

    // Enhanced email data with AI classification and priority scoring
    const enhancedEmails = emailsResult.data.emails.map(email => {
      const classification = classificationMap.get(email.id);
      const priorityScore = calculatePriorityScore(email, classification, userPreferences);
      
      return {
        ...email,
        classification,
        priorityScore,
        isHighPriority: priorityScore >= 7,
        needsClassification: !classification,
      };
    });

    // Apply smart filters
    let filteredEmails = enhancedEmails;

    if (params.urgencyFilter !== undefined) {
      filteredEmails = filteredEmails.filter(email => 
        email.classification?.urgency >= params.urgencyFilter! || (!email.classification && params.includeUnclassified)
      );
    }

    if (params.importanceFilter !== undefined) {
      filteredEmails = filteredEmails.filter(email => 
        email.classification?.importance >= params.importanceFilter! || (!email.classification && params.includeUnclassified)
      );
    }

    if (params.categoryFilter) {
      filteredEmails = filteredEmails.filter(email => 
        email.classification?.category === params.categoryFilter || (!email.classification && params.includeUnclassified)
      );
    }

    if (params.actionRequired !== undefined) {
      filteredEmails = filteredEmails.filter(email => 
        email.classification?.actionRequired === params.actionRequired || (!email.classification && params.includeUnclassified)
      );
    }

    // Sort emails based on selected criteria
    filteredEmails.sort((a, b) => {
      let comparison = 0;
      
      switch (params.sortBy) {
        case 'urgency':
          comparison = (b.classification?.urgency ?? 0) - (a.classification?.urgency ?? 0);
          break;
        case 'importance':
          comparison = (b.classification?.importance ?? 0) - (a.classification?.importance ?? 0);
          break;
        case 'priority_score':
          comparison = b.priorityScore - a.priorityScore;
          break;
        case 'date':
        default:
          comparison = b.date.getTime() - a.date.getTime();
          break;
      }
      
      return params.sortOrder === 'asc' ? -comparison : comparison;
    });

    // Generate smart insights
    const insights = generateSmartInsights(filteredEmails, userPreferences);

    return NextResponse.json({
      success: true,
      data: {
        emails: filteredEmails,
        insights,
        totalEmails: filteredEmails.length,
        unclassifiedCount: filteredEmails.filter(email => !email.classification).length,
        highPriorityCount: filteredEmails.filter(email => email.isHighPriority).length,
        actionRequiredCount: filteredEmails.filter(email => email.classification?.actionRequired).length,
        nextPageToken: emailsResult.data.nextPageToken,
        filterSummary: {
          urgencyFilter: params.urgencyFilter,
          importanceFilter: params.importanceFilter,
          categoryFilter: params.categoryFilter,
          actionRequired: params.actionRequired,
          priorityMode: params.priorityMode,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
        },
      },
    });

  } catch (error) {
    console.error('Smart filter API error:', error);
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
 * Calculate priority score for an email based on AI classification and user preferences
 */
function calculatePriorityScore(
  email: Email, 
  classification: any | null, 
  userPreferences: UserPreferences
): number {
  let score = 0;

  // Base score from Gmail importance and labels
  if (email.isImportant) score += 2;
  if (email.labels.includes('IMPORTANT')) score += 2;
  if (email.labels.includes('STARRED')) score += 1;

  if (classification) {
    // AI classification scoring (0-10 scale)
    score += classification.urgency * 1.5; // Max +7.5
    score += classification.importance * 1.0; // Max +5
    
    if (classification.actionRequired) score += 3;

    // Category-based scoring with user preferences
    if (userPreferences.priorityCategories.includes(classification.category as EmailCategory)) {
      score += 2;
    }

    // Time-sensitive scoring
    const hoursSinceReceived = (Date.now() - email.date.getTime()) / (1000 * 60 * 60);
    if (classification.urgency >= 4 && hoursSinceReceived < 24) {
      score += 2; // Recent urgent emails get boost
    }

    // Opportunity detection
    if (classification.category === 'opportunity') {
      score += 3;
    }

    // Work category during business hours
    if (classification.category === 'work') {
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();
      
      if (userPreferences.workingHours.days.includes(currentDay as 0 | 1 | 2 | 3 | 4 | 5 | 6) &&
          currentHour >= parseInt(userPreferences.workingHours.start.split(':')[0]!) &&
          currentHour <= parseInt(userPreferences.workingHours.end.split(':')[0]!)) {
        score += 1.5;
      }
    }
  } else {
    // Unclassified emails get moderate priority
    score += 3;
  }

  return Math.min(Math.max(score, 0), 10); // Clamp to 0-10 range
}

/**
 * Generate smart insights about the filtered emails
 */
function generateSmartInsights(
  emails: Array<Email & { classification?: any; priorityScore: number; isHighPriority: boolean }>,
  _userPreferences: UserPreferences
): {
  summary: string;
  recommendations: readonly string[];
  urgentCount: number;
  overdueActionItems: number;
  categoryBreakdown: Record<string, number>;
} {
  const urgentEmails = emails.filter(email => email.classification?.urgency >= 4);
  const actionRequiredEmails = emails.filter(email => email.classification?.actionRequired);
  const highPriorityEmails = emails.filter(email => email.isHighPriority);
  
  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  emails.forEach(email => {
    const category = email.classification?.category || 'unclassified';
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
  });

  // Overdue action items (action required emails older than 24 hours)
  const overdueActionItems = actionRequiredEmails.filter(email => {
    const hoursSince = (Date.now() - email.date.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  }).length;

  const recommendations: string[] = [];

  if (urgentEmails.length > 0) {
    recommendations.push(`You have ${urgentEmails.length} urgent email${urgentEmails.length > 1 ? 's' : ''} requiring immediate attention`);
  }

  if (overdueActionItems > 0) {
    recommendations.push(`${overdueActionItems} action item${overdueActionItems > 1 ? 's are' : ' is'} overdue (>24 hours old)`);
  }

  if (highPriorityEmails.length > 5) {
    recommendations.push(`Consider processing ${highPriorityEmails.length} high-priority emails in focused time blocks`);
  }

  const workEmails = emails.filter(email => email.classification?.category === 'work').length;
  const personalEmails = emails.filter(email => email.classification?.category === 'personal').length;
  
  if (workEmails > personalEmails * 3) {
    recommendations.push('Heavy work email load - consider setting boundaries or delegation');
  }

  const unclassifiedCount = emails.filter(email => !email.classification).length;
  if (unclassifiedCount > 10) {
    recommendations.push(`${unclassifiedCount} emails need AI classification for better prioritization`);
  }

  let summary = `${emails.length} emails processed`;
  if (highPriorityEmails.length > 0) {
    summary += `, ${highPriorityEmails.length} high-priority`;
  }
  if (actionRequiredEmails.length > 0) {
    summary += `, ${actionRequiredEmails.length} requiring action`;
  }

  return {
    summary,
    recommendations: recommendations as readonly string[],
    urgentCount: urgentEmails.length,
    overdueActionItems,
    categoryBreakdown,
  };
}

export interface SmartFilterResponse {
  readonly success: boolean;
  readonly data?: {
    readonly emails: ReadonlyArray<Email & {
      readonly classification?: any;
      readonly priorityScore: number;
      readonly isHighPriority: boolean;
      readonly needsClassification: boolean;
    }>;
    readonly insights: {
      readonly summary: string;
      readonly recommendations: readonly string[];
      readonly urgentCount: number;
      readonly overdueActionItems: number;
      readonly categoryBreakdown: Record<string, number>;
    };
    readonly totalEmails: number;
    readonly unclassifiedCount: number;
    readonly highPriorityCount: number;
    readonly actionRequiredCount: number;
    readonly nextPageToken?: string;
    readonly filterSummary: {
      readonly urgencyFilter?: number;
      readonly importanceFilter?: number;
      readonly categoryFilter?: string;
      readonly actionRequired?: boolean;
      readonly priorityMode: string;
      readonly sortBy: string;
      readonly sortOrder: string;
    };
  };
  readonly error?: string;
  readonly details?: unknown;
}