/**
 * Meeting Detection API Route
 * POST /api/calendar/detect-meetings
 * 
 * Detects meeting requests from email content and suggests calendar events
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGoogleCalendarClient, GoogleCalendarClient } from '@/integrations/calendar/google-calendar';
import { Email, EmailAddress } from '@/types';
import { createGmailAuthService } from '@/integrations/gmail';
import { z } from 'zod';

// Request validation schema
const detectMeetingsSchema = z.object({
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
  })).min(1).max(50), // Process up to 50 emails at once
  suggestTimeSlots: z.boolean().optional().default(true),
  workingHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().min(0).max(6)),
  }).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = detectMeetingsSchema.safeParse(body);

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

    const { emails: emailsData, suggestTimeSlots, workingHours } = validationResult.data;

    // Get authenticated user from server-side cookies
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Convert email data to Email type
    const emails: Email[] = emailsData.map(emailData => ({
      ...emailData,
      date: new Date(emailData.date),
      recipients: emailData.recipients as readonly EmailAddress[],
      labels: emailData.labels as readonly string[],
    }));

    // Process each email for meeting detection
    const meetingDetections: Array<{
      emailId: string;
      detection: ReturnType<typeof GoogleCalendarClient.detectMeetingFromEmail>;
      suggestedEvent?: {
        title: string;
        description: string;
        suggestedTimes?: Array<{
          start: Date;
          end: Date;
          confidence: number;
        }>;
        attendees: string[];
        priority: 'high' | 'medium' | 'low';
      };
    }> = [];

    let calendarClient: GoogleCalendarClient | null = null;

    // Initialize calendar client if time slot suggestions are needed
    if (suggestTimeSlots) {
      const authService = createGmailAuthService();
      const tokensResult = await authService.getTokens(user.id);

      if (tokensResult.success && tokensResult.data) {
        calendarClient = createGoogleCalendarClient({
          clientId: process.env['GOOGLE_CLIENT_ID']!,
          clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
          redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
        });

        calendarClient.setCredentials(tokensResult.data);

        // Check token refresh
        if (authService.isTokenExpired(tokensResult.data)) {
          const refreshResult = await calendarClient.refreshTokenIfNeeded();
          if (!refreshResult.success) {
            console.warn('Failed to refresh calendar token for time slot suggestions');
            calendarClient = null;
          }
        }
      }
    }

    // Process each email
    for (const email of emails) {
      const emailContent: {
        readonly subject?: string;
        readonly bodyText?: string;
        readonly bodyHtml?: string;
        readonly sender: { readonly email: string; readonly name?: string };
      } = {
        sender: {
          email: email.sender.email,
          ...(email.sender.name && { name: email.sender.name }),
        },
      };
      
      if (email.subject) {
        (emailContent as any).subject = email.subject;
      }
      if (email.bodyText) {
        (emailContent as any).bodyText = email.bodyText;
      }
      if (email.bodyHtml) {
        (emailContent as any).bodyHtml = email.bodyHtml;
      }
      
      const detection = GoogleCalendarClient.detectMeetingFromEmail(emailContent);

      if (detection.hasMeetingRequest) {
        let suggestedEvent: typeof meetingDetections[0]['suggestedEvent'];

        // Create event suggestion
        const eventDescription = `Meeting request from: ${email.sender.name || email.sender.email}\n\n` +
                               `Original email subject: ${email.subject ?? '(no subject)'}\n\n` +
                               `Email snippet: ${email.snippet}`;

        const attendeeEmails = [
          email.sender.email,
          ...email.recipients.map(r => r.email),
        ].filter(email => email !== user.email); // Exclude current user

        suggestedEvent = {
          title: detection.suggestedTitle ?? 'Meeting',
          description: eventDescription,
          attendees: attendeeEmails,
          priority: determineMeetingPriority(email, detection),
        };

        // Generate time slot suggestions if calendar access available
        if (calendarClient && suggestTimeSlots) {
          const timeSlots = await generateTimeSlotSuggestions(
            calendarClient,
            detection,
            workingHours || {
              start: '09:00',
              end: '17:00',
              days: [1, 2, 3, 4, 5],
            }
          );
          suggestedEvent.suggestedTimes = timeSlots;
        }

        meetingDetections.push({
          emailId: email.id,
          detection,
          suggestedEvent,
        });
      } else {
        // Still include emails without meeting requests for completeness
        meetingDetections.push({
          emailId: email.id,
          detection,
        });
      }
    }

    // Generate summary insights
    const meetingRequestCount = meetingDetections.filter(d => d.detection.hasMeetingRequest).length;
    const highPriorityCount = meetingDetections.filter(d => d.suggestedEvent?.priority === 'high').length;
    
    const meetingTypes = meetingDetections
      .filter(d => d.detection.hasMeetingRequest)
      .reduce((acc, d) => {
        const type = d.detection.meetingType || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Store meeting detections for analytics
    if (meetingRequestCount > 0) {
      await (supabase as any)
        .from('meeting_detections')
        .insert({
          user_id: user.id,
          total_emails_processed: emails.length,
          meetings_detected: meetingRequestCount,
          high_priority_meetings: highPriorityCount,
          meeting_types: meetingTypes,
          detection_timestamp: new Date().toISOString(),
        })
        .then(() => {
          // Logging successful
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        detections: meetingDetections,
        summary: {
          totalEmails: emails.length,
          meetingRequestsFound: meetingRequestCount,
          highPriorityMeetings: highPriorityCount,
          meetingTypeBreakdown: meetingTypes,
          suggestedTimeSlots: suggestTimeSlots && !!calendarClient,
        },
        insights: generateMeetingInsights(meetingDetections),
      },
    });

  } catch (error) {
    console.error('Meeting detection API error:', error);
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
 * Determine meeting priority based on email and detection context
 */
function determineMeetingPriority(
  email: Email,
  detection: ReturnType<typeof GoogleCalendarClient.detectMeetingFromEmail>
): 'high' | 'medium' | 'low' {
  let score = 0;

  // Email importance indicators
  if (email.isImportant) score += 2;
  if (email.labels.includes('IMPORTANT')) score += 2;

  // Meeting type priority
  if (detection.meetingType === 'interview') score += 3;
  else if (detection.meetingType === 'demo') score += 2;
  else if (detection.meetingType === 'presentation') score += 2;

  // Urgency indicators in content
  const content = `${email.subject || ''} ${email.snippet}`.toLowerCase();
  if (content.includes('urgent') || content.includes('asap')) score += 3;
  if (content.includes('important') || content.includes('deadline')) score += 2;

  // Time sensitivity
  const hoursSinceReceived = (Date.now() - email.date.getTime()) / (1000 * 60 * 60);
  if (hoursSinceReceived < 24) score += 1;

  // Detected dates (time-sensitive)
  if (detection.detectedDates && detection.detectedDates.length > 0) {
    const nearestDate = Math.min(...detection.detectedDates.map(d => d.getTime()));
    const daysUntil = (nearestDate - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 3) score += 2;
    else if (daysUntil <= 7) score += 1;
  }

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Generate time slot suggestions using calendar availability
 */
async function generateTimeSlotSuggestions(
  calendarClient: GoogleCalendarClient,
  detection: ReturnType<typeof GoogleCalendarClient.detectMeetingFromEmail>,
  workingHours: { start: string; end: string; days: number[] }
): Promise<Array<{
  start: Date;
  end: Date;
  confidence: number;
}>> {
  const duration = detection.suggestedDuration || 30;
  
  // Look for available slots in the next 2 weeks
  const startDate = new Date();
  const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  try {
    const availableSlotsResult = await calendarClient.findAvailableSlots({
      startDate,
      endDate,
      durationMinutes: duration,
      workingHours,
      bufferMinutes: 15,
    });

    if (!availableSlotsResult.success) {
      return [];
    }

    // Score and sort available slots
    const scoredSlots = availableSlotsResult.data.map(slot => {
      let confidence = 0.5; // Base confidence

      // Prefer slots during prime meeting hours (10am-4pm)
      const hour = slot.start.getHours();
      if (hour >= 10 && hour <= 16) confidence += 0.3;

      // Prefer slots not on Monday morning or Friday afternoon
      const dayOfWeek = slot.start.getDay();
      const isMonday = dayOfWeek === 1;
      const isFriday = dayOfWeek === 5;
      
      if (isMonday && hour < 11) confidence -= 0.2;
      if (isFriday && hour > 15) confidence -= 0.2;

      // Prefer slots that align with detected dates
      if (detection.detectedDates && detection.detectedDates.length > 0) {
        const slotDate = slot.start.toDateString();
        const hasMatchingDate = detection.detectedDates.some(
          detectedDate => detectedDate.toDateString() === slotDate
        );
        if (hasMatchingDate) confidence += 0.4;
      }

      // Prefer nearer slots slightly
      const daysFromNow = (slot.start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysFromNow <= 3) confidence += 0.1;

      return {
        start: slot.start,
        end: slot.end,
        confidence: Math.min(confidence, 1.0),
      };
    });

    // Sort by confidence and return top 5
    return scoredSlots
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

  } catch (error) {
    console.warn('Failed to generate time slot suggestions:', error);
    return [];
  }
}

/**
 * Generate insights about detected meetings
 */
function generateMeetingInsights(
  detections: Array<{
    emailId: string;
    detection: ReturnType<typeof GoogleCalendarClient.detectMeetingFromEmail>;
    suggestedEvent?: any;
  }>
): {
  recommendations: string[];
  patterns: Record<string, unknown>;
  urgentMeetings: number;
} {
  const meetingRequests = detections.filter(d => d.detection.hasMeetingRequest);
  const recommendations: string[] = [];
  
  const urgentMeetings = meetingRequests.filter(d => d.suggestedEvent?.priority === 'high').length;
  
  if (urgentMeetings > 0) {
    recommendations.push(`${urgentMeetings} high-priority meeting request${urgentMeetings > 1 ? 's' : ''} require prompt response`);
  }

  if (meetingRequests.length > 3) {
    recommendations.push('Consider batching meeting scheduling to save time');
  }

  const interviewCount = meetingRequests.filter(d => d.detection.meetingType === 'interview').length;
  if (interviewCount > 0) {
    recommendations.push(`${interviewCount} interview${interviewCount > 1 ? 's' : ''} detected - ensure adequate preparation time`);
  }

  const hasConflictingDates = meetingRequests.some(d => 
    d.detection.detectedDates && d.detection.detectedDates.length > 1
  );
  if (hasConflictingDates) {
    recommendations.push('Some emails contain multiple dates - clarification may be needed');
  }

  const patterns = {
    commonMeetingTypes: meetingRequests.reduce((acc, d) => {
      const type = d.detection.meetingType || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    averageSuggestedDuration: meetingRequests.length > 0 
      ? meetingRequests.reduce((sum, d) => sum + (d.detection.suggestedDuration || 30), 0) / meetingRequests.length
      : 0,
    hasFollowUps: meetingRequests.filter(d => d.detection.isFollowUp).length,
  };

  return {
    recommendations,
    patterns,
    urgentMeetings,
  };
}

export interface MeetingDetectionResponse {
  readonly success: boolean;
  readonly data?: {
    readonly detections: ReadonlyArray<{
      readonly emailId: string;
      readonly detection: {
        readonly hasMeetingRequest: boolean;
        readonly suggestedTitle?: string;
        readonly suggestedDuration?: number;
        readonly detectedDates?: readonly Date[];
        readonly detectedTimes?: readonly string[];
        readonly isFollowUp?: boolean;
        readonly meetingType?: 'interview' | 'demo' | 'meeting' | 'call' | 'presentation' | 'other';
      };
      readonly suggestedEvent?: {
        readonly title: string;
        readonly description: string;
        readonly suggestedTimes?: ReadonlyArray<{
          readonly start: Date;
          readonly end: Date;
          readonly confidence: number;
        }>;
        readonly attendees: readonly string[];
        readonly priority: 'high' | 'medium' | 'low';
      };
    }>;
    readonly summary: {
      readonly totalEmails: number;
      readonly meetingRequestsFound: number;
      readonly highPriorityMeetings: number;
      readonly meetingTypeBreakdown: Record<string, number>;
      readonly suggestedTimeSlots: boolean;
    };
    readonly insights: {
      readonly recommendations: readonly string[];
      readonly patterns: Record<string, unknown>;
      readonly urgentMeetings: number;
    };
  };
  readonly error?: string;
  readonly details?: unknown;
}