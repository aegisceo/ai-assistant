/**
 * Batch Historical Processing API Route
 * POST /api/batch/process-history
 * 
 * Processes the last 2 weeks of emails and calendar events for initial dashboard population
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GmailClient, createGmailAuthService } from '@/integrations/gmail';
import { createGoogleCalendarClient } from '@/integrations/calendar/google-calendar';
import { createEmailClassifier } from '@/agents/email-classifier';
import { Email, UserPreferences } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🚀 Starting historical batch processing...');
    
    // Get authenticated user
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

    // Get/create user preferences
    let { data: preferencesData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!preferencesData) {
      // Create default preferences
      const { data: newPrefs } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
          email_classification_enabled: true,
          auto_unsubscribe_enabled: false,
          priority_categories: ['work', 'financial'],
          working_hours: {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5],
          },
          notification_settings: {
            urgentEmails: true,
            upcomingEvents: true,
            missedOpportunities: false,
          },
        })
        .select()
        .single();
      preferencesData = newPrefs;
    }

    const userPreferences: UserPreferences = {
      emailClassificationEnabled: preferencesData!.email_classification_enabled ?? true,
      autoUnsubscribeEnabled: preferencesData!.auto_unsubscribe_enabled ?? false,
      priorityCategories: (preferencesData!.priority_categories ?? ['work', 'financial']) as readonly ('work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other')[],
      workingHours: preferencesData!.working_hours ? {
        start: preferencesData!.working_hours.start ?? '09:00',
        end: preferencesData!.working_hours.end ?? '17:00',
        days: (preferencesData!.working_hours.days ?? [1, 2, 3, 4, 5]) as readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      } : {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] as const,
      },
      notificationSettings: preferencesData!.notification_settings ? {
        urgentEmails: preferencesData!.notification_settings.urgentEmails ?? true,
        upcomingEvents: preferencesData!.notification_settings.upcomingEvents ?? true,
        missedOpportunities: preferencesData!.notification_settings.missedOpportunities ?? false,
      } : {
        urgentEmails: true,
        upcomingEvents: true,
        missedOpportunities: false,
      },
    };

    // Get Gmail tokens
    const authService = createGmailAuthService();
    const tokensResult = await authService.getTokens(user.id);

    if (!tokensResult.success || !tokensResult.data) {
      return NextResponse.json(
        { success: false, error: 'Gmail not connected. Please authenticate first.' },
        { status: 403 }
      );
    }

    // Initialize Gmail client
    const gmailClient = new GmailClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    gmailClient.setCredentials(tokensResult.data);

    // Initialize Calendar client
    const calendarClient = createGoogleCalendarClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    calendarClient.setCredentials(tokensResult.data);

    // Initialize AI classifier
    const classifier = createEmailClassifier();

    // Check token refresh
    if (authService.isTokenExpired(tokensResult.data)) {
      const refreshResult = await gmailClient.refreshTokenIfNeeded();
      if (!refreshResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh tokens' },
          { status: 401 }
        );
      }
    }

    const results = {
      emails: {
        fetched: 0,
        classified: 0,
        errors: 0,
      },
      calendar: {
        events: 0,
        meetings_detected: 0,
        errors: 0,
      },
      processing_time_ms: 0,
    };

    const startTime = Date.now();

    // 1. Fetch emails from last 2 weeks
    console.log('📧 Fetching emails from last 2 weeks...');
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const gmailQuery = `after:${Math.floor(twoWeeksAgo.getTime() / 1000)}`;
    
    try {
      const emailsResult = await gmailClient.fetchEmails({
        maxResults: 200, // Process up to 200 emails for initial test
        query: gmailQuery,
        labelIds: ['INBOX'] as const,
        includeSpamTrash: false,
      });

      if (emailsResult.success) {
        results.emails.fetched = emailsResult.data.emails.length;
        console.log(`✅ Fetched ${results.emails.fetched} emails`);

        // 2. Classify emails in batches
        const batchSize = 5; // Process 5 emails at a time
        
        for (let i = 0; i < emailsResult.data.emails.length; i += batchSize) {
          const batch = emailsResult.data.emails.slice(i, i + batchSize);
          console.log(`🤖 Classifying emails ${i + 1}-${Math.min(i + batchSize, emailsResult.data.emails.length)}...`);
          
          await Promise.all(
            batch.map(async (email) => {
              try {
                // Check if already classified
                const { data: existingEmail } = await supabase
                  .from('emails')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('gmail_id', email.id)
                  .single();

                if (existingEmail) {
                  return; // Skip if already processed
                }

                // Classify email
                const classificationResult = await classifier.classifyEmail({
                  email,
                  context: { userPreferences },
                });

                if (classificationResult.success) {
                  // Store classification
                  await supabase
                    .from('emails')
                    .insert({
                      user_id: user.id,
                      gmail_id: email.id,
                      subject: email.subject,
                      sender_email: email.sender.email,
                      sender_name: email.sender.name || null,
                      received_at: email.date.toISOString(),
                      classification: {
                        urgency: classificationResult.data.urgency,
                        importance: classificationResult.data.importance,
                        actionRequired: classificationResult.data.actionRequired,
                        category: classificationResult.data.category,
                        confidence: classificationResult.data.confidence,
                        reasoning: classificationResult.data.reasoning,
                      },
                      processed_at: new Date().toISOString(),
                    });

                  results.emails.classified++;
                } else {
                  results.emails.errors++;
                  console.warn(`Failed to classify email ${email.id}:`, classificationResult.error);
                }
              } catch (error) {
                results.emails.errors++;
                console.error(`Error processing email ${email.id}:`, error);
              }
            })
          );

          // Add small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    }

    // 3. Fetch calendar events from last 2 weeks
    console.log('📅 Fetching calendar events from last 2 weeks...');
    try {
      const eventsResult = await calendarClient.listEvents({
        timeMin: twoWeeksAgo,
        timeMax: new Date(),
        maxResults: 100,
      });

      if (eventsResult.success) {
        results.calendar.events = eventsResult.data.events.length;
        console.log(`✅ Found ${results.calendar.events} calendar events`);

        // Store calendar events
        for (const event of eventsResult.data.events) {
          try {
            await supabase
              .from('calendar_events')
              .upsert({
                user_id: user.id,
                google_event_id: event.id,
                title: event.title,
                start_time: event.start.toISOString(),
                end_time: event.end.toISOString(),
                location: event.location || null,
                attendees_count: event.attendees.length,
              }, {
                onConflict: 'user_id,google_event_id'
              });
          } catch (error) {
            results.calendar.errors++;
            console.warn(`Failed to store calendar event ${event.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      results.calendar.errors++;
    }

    // 4. Run meeting detection on classified emails
    console.log('🤝 Running meeting detection...');
    try {
      const { data: recentEmails } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', user.id)
        .gte('received_at', twoWeeksAgo.toISOString())
        .order('received_at', { ascending: false });

      if (recentEmails) {
        const emailsForDetection = recentEmails.map(dbEmail => ({
          id: dbEmail.gmail_id,
          threadId: dbEmail.gmail_id, // Simplified for now
          subject: dbEmail.subject,
          sender: {
            email: dbEmail.sender_email,
            name: dbEmail.sender_name,
          },
          recipients: [],
          date: new Date(dbEmail.received_at),
          snippet: '', // We don't store snippets, so empty for now
          bodyText: null,
          bodyHtml: null,
          isRead: true,
          isImportant: false,
          labels: [] as readonly string[],
        })) as Email[];

        // Run meeting detection (simplified version)
        let meetingsDetected = 0;
        for (const email of emailsForDetection.slice(0, 50)) { // Limit to 50 for processing
          const detection = calendarClient.constructor.prototype.detectMeetingFromEmail
            ? (calendarClient.constructor as any).detectMeetingFromEmail({
                subject: email.subject,
                bodyText: email.bodyText,
                bodyHtml: email.bodyHtml,
                sender: email.sender,
              })
            : { hasMeetingRequest: false };
          
          if (detection.hasMeetingRequest) {
            meetingsDetected++;
          }
        }
        
        results.calendar.meetings_detected = meetingsDetected;
      }
    } catch (error) {
      console.error('Error with meeting detection:', error);
    }

    results.processing_time_ms = Date.now() - startTime;

    console.log('🎉 Batch processing complete!', results);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          emails_fetched: results.emails.fetched,
          emails_classified: results.emails.classified,
          calendar_events: results.calendar.events,
          meetings_detected: results.calendar.meetings_detected,
          processing_time_seconds: Math.round(results.processing_time_ms / 1000),
        },
        results,
        message: `Successfully processed ${results.emails.classified} emails and ${results.calendar.events} calendar events from the last 2 weeks!`,
      },
    });

  } catch (error) {
    console.error('Batch processing error:', error);
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

export interface BatchProcessResponse {
  readonly success: boolean;
  readonly data?: {
    readonly summary: {
      readonly emails_fetched: number;
      readonly emails_classified: number;
      readonly calendar_events: number;
      readonly meetings_detected: number;
      readonly processing_time_seconds: number;
    };
    readonly results: {
      readonly emails: {
        readonly fetched: number;
        readonly classified: number;
        readonly errors: number;
      };
      readonly calendar: {
        readonly events: number;
        readonly meetings_detected: number;
        readonly errors: number;
      };
      readonly processing_time_ms: number;
    };
    readonly message: string;
  };
  readonly error?: string;
  readonly details?: unknown;
}