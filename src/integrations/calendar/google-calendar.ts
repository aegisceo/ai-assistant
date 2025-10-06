/**
 * Google Calendar Integration
 * Handles Google Calendar API interactions for meeting detection and scheduling
 */

import { google, calendar_v3 } from 'googleapis';
import { GmailTokens } from '@/types/api';
import { Result } from '@/lib/types';
import { CalendarEvent, EventAttendee } from '@/types';

export interface GoogleCalendarConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export class GoogleCalendarClient {
  private readonly oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private calendar: calendar_v3.Calendar | null = null;

  constructor(config: GoogleCalendarConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Set OAuth2 credentials
   */
  public setCredentials(tokens: GmailTokens): void {
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      expiry_date: tokens.expiryDate,
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Refresh token if needed
   */
  public async refreshTokenIfNeeded(): Promise<Result<GmailTokens, Error>> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token || !credentials.refresh_token) {
        return {
          success: false,
          error: new Error('Failed to refresh token - missing required credentials'),
        };
      }

      return {
        success: true,
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token!,
          tokenType: credentials.token_type || 'Bearer',
          scope: credentials.scope || '',
          expiryDate: credentials.expiry_date || Date.now() + 3600000,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error during token refresh'),
      };
    }
  }

  /**
   * List upcoming calendar events
   */
  public async listEvents(options: {
    readonly timeMin?: Date;
    readonly timeMax?: Date;
    readonly maxResults?: number;
    readonly calendarId?: string;
    readonly query?: string;
  } = {}): Promise<Result<{
    readonly events: readonly CalendarEvent[];
    readonly nextPageToken?: string;
  }, Error>> {
    try {
      if (!this.calendar) {
        return {
          success: false,
          error: new Error('Calendar client not initialized - credentials not set'),
        };
      }

      const calendarId = options.calendarId || 'primary';
      const timeMin = options.timeMin || new Date();
      const timeMax = options.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: options.maxResults || 50,
        singleEvents: true,
        orderBy: 'startTime',
        ...(options.query && { q: options.query }),
      });

      const events: CalendarEvent[] = (response.data.items || []).map(item => {
        const event: CalendarEvent = {
          id: item.id!,
          title: item.summary || '(No title)',
          start: new Date(item.start?.dateTime || item.start?.date || ''),
          end: new Date(item.end?.dateTime || item.end?.date || ''),
          attendees: (item.attendees || []).map(attendee => ({
            email: attendee.email!,
            name: attendee.displayName ?? undefined,
            responseStatus: (attendee.responseStatus as EventAttendee['responseStatus']) || 'needsAction',
          })) as readonly EventAttendee[],
          isAllDay: !!(item.start?.date && !item.start?.dateTime),
          status: (item.status as CalendarEvent['status']) || 'confirmed',
        };
        
        // Add optional properties only if they exist
        if (item.description) {
          (event as any).description = item.description;
        }
        if (item.location) {
          (event as any).location = item.location;
        }
        
        return event;
      });

      const result: {
        readonly events: readonly CalendarEvent[];
        readonly nextPageToken?: string;
      } = {
        events: events as readonly CalendarEvent[],
      };
      
      if (response.data.nextPageToken) {
        (result as any).nextPageToken = response.data.nextPageToken;
      }
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to list calendar events'),
      };
    }
  }

  /**
   * Create a new calendar event
   */
  public async createEvent(eventData: {
    readonly title: string;
    readonly description?: string;
    readonly start: Date;
    readonly end: Date;
    readonly location?: string;
    readonly attendees?: readonly string[]; // Email addresses
    readonly calendarId?: string;
  }): Promise<Result<CalendarEvent, Error>> {
    try {
      if (!this.calendar) {
        return {
          success: false,
          error: new Error('Calendar client not initialized - credentials not set'),
        };
      }

      const calendarId = eventData.calendarId || 'primary';

      const requestBody: any = {
        summary: eventData.title,
        start: {
          dateTime: eventData.start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: eventData.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      
      if (eventData.description) {
        requestBody.description = eventData.description;
      }
      if (eventData.location) {
        requestBody.location = eventData.location;
      }
      if (eventData.attendees && eventData.attendees.length > 0) {
        requestBody.attendees = eventData.attendees.map(email => ({ email }));
      }

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody,
      });

      const event = (response as any).data;
      const createdEvent: CalendarEvent = {
        id: event.id!,
        title: event.summary || eventData.title,
        start: new Date(event.start?.dateTime || event.start?.date || eventData.start),
        end: new Date(event.end?.dateTime || event.end?.date || eventData.end),
        attendees: (event.attendees || []).map((attendee: any) => ({
          email: attendee.email!,
          name: attendee.displayName ?? undefined,
          responseStatus: (attendee.responseStatus as EventAttendee['responseStatus']) || 'needsAction',
        })) as readonly EventAttendee[],
        isAllDay: !!(event.start?.date && !event.start?.dateTime),
        status: (event.status as CalendarEvent['status']) || 'confirmed',
      };
      
      // Add optional properties
      if (event.description || eventData.description) {
        (createdEvent as any).description = event.description || eventData.description;
      }
      if (event.location || eventData.location) {
        (createdEvent as any).location = event.location || eventData.location;
      }

      return {
        success: true,
        data: createdEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to create calendar event'),
      };
    }
  }

  /**
   * Find available time slots for scheduling
   */
  public async findAvailableSlots(options: {
    readonly startDate: Date;
    readonly endDate: Date;
    readonly durationMinutes: number;
    readonly workingHours?: {
      readonly start: string; // HH:MM
      readonly end: string;   // HH:MM
      readonly days: readonly number[];
    };
    readonly bufferMinutes?: number; // Buffer time between meetings
  }): Promise<Result<readonly {
    readonly start: Date;
    readonly end: Date;
    readonly duration: number;
  }[], Error>> {
    try {
      // Get busy times from calendar
      const eventsResult = await this.listEvents({
        timeMin: options.startDate,
        timeMax: options.endDate,
      });

      if (!eventsResult.success) {
        return eventsResult;
      }

      const busyTimes = eventsResult.data.events
        .filter(event => event.status === 'confirmed')
        .map(event => ({
          start: event.start,
          end: event.end,
        }));

      // Generate available slots
      const availableSlots: Array<{
        readonly start: Date;
        readonly end: Date;
        readonly duration: number;
      }> = [];

      const workingHours = options.workingHours || {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5], // Monday to Friday
      };

      const bufferMinutes = options.bufferMinutes || 15;

      // Iterate through each day
      let currentDate = new Date(options.startDate);
      while (currentDate < options.endDate) {
        const dayOfWeek = currentDate.getDay();
        
        // Skip if not a working day
        if (!workingHours.days.includes(dayOfWeek)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Set working hours for this day
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);

        const dayStart = new Date(currentDate);
        dayStart.setHours(startHour!, startMinute!, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(endHour!, endMinute!, 0, 0);

        // Find available slots within working hours
        let slotStart = new Date(dayStart);

        while (slotStart.getTime() + options.durationMinutes * 60000 <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + options.durationMinutes * 60000);

          // Check if this slot conflicts with any busy time
          const hasConflict = busyTimes.some(busy => {
            const busyStart = busy.start.getTime() - bufferMinutes * 60000;
            const busyEnd = busy.end.getTime() + bufferMinutes * 60000;
            
            return (
              (slotStart.getTime() >= busyStart && slotStart.getTime() < busyEnd) ||
              (slotEnd.getTime() > busyStart && slotEnd.getTime() <= busyEnd) ||
              (slotStart.getTime() <= busyStart && slotEnd.getTime() >= busyEnd)
            );
          });

          if (!hasConflict) {
            availableSlots.push({
              start: new Date(slotStart),
              end: new Date(slotEnd),
              duration: options.durationMinutes,
            });
          }

          // Move to next potential slot (15-minute increments)
          slotStart = new Date(slotStart.getTime() + 15 * 60000);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        success: true,
        data: availableSlots,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to find available slots'),
      };
    }
  }

  /**
   * Detect meeting information from email content
   */
  public static detectMeetingFromEmail(emailContent: {
    readonly subject?: string;
    readonly bodyText?: string;
    readonly bodyHtml?: string;
    readonly sender: { readonly email: string; readonly name?: string };
  }): {
    readonly hasMeetingRequest: boolean;
    readonly suggestedTitle?: string;
    readonly suggestedDuration?: number; // minutes
    readonly detectedDates?: readonly Date[];
    readonly detectedTimes?: readonly string[];
    readonly isFollowUp?: boolean;
    readonly meetingType?: 'interview' | 'demo' | 'meeting' | 'call' | 'presentation' | 'other';
  } {
    const subject = emailContent.subject?.toLowerCase() || '';
    const body = (emailContent.bodyText || emailContent.bodyHtml || '').toLowerCase();
    const fullContent = `${subject} ${body}`;

    // Meeting request indicators
    const meetingKeywords = [
      'meeting', 'call', 'zoom', 'teams', 'hangouts', 'skype',
      'conference', 'discussion', 'demo', 'interview', 'presentation',
      'catch up', 'sync', 'standup', 'review', 'brainstorm'
    ];

    const actionKeywords = [
      'schedule', 'book', 'arrange', 'set up', 'plan',
      'available', 'free time', 'calendar', 'when can'
    ];

    const hasMeetingRequest = meetingKeywords.some(keyword => fullContent.includes(keyword)) &&
                            actionKeywords.some(keyword => fullContent.includes(keyword));

    if (!hasMeetingRequest) {
      return { hasMeetingRequest: false };
    }

    // Detect meeting type
    let meetingType: 'interview' | 'demo' | 'meeting' | 'call' | 'presentation' | 'other' = 'meeting';
    if (subject.includes('interview') || body.includes('interview')) {
      meetingType = 'interview';
    } else if (subject.includes('demo') || body.includes('demonstration')) {
      meetingType = 'demo';
    } else if (fullContent.includes('call')) {
      meetingType = 'call';
    } else if (fullContent.includes('presentation') || fullContent.includes('present')) {
      meetingType = 'presentation';
    }

    // Suggest duration based on meeting type
    let suggestedDuration = 30; // Default 30 minutes
    if (meetingType === 'interview') {
      suggestedDuration = 60;
    } else if (meetingType === 'demo' || meetingType === 'presentation') {
      suggestedDuration = 45;
    } else if (fullContent.includes('quick') || fullContent.includes('brief')) {
      suggestedDuration = 15;
    }

    // Extract potential dates and times
    const dateRegex = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\b/gi;
    const timeRegex = /\b(?:\d{1,2}:\d{2}\s*(?:am|pm)|(?:morning|afternoon|evening))\b/gi;

    const detectedDates: Date[] = [];
    const dateMatches = fullContent.match(dateRegex);
    if (dateMatches) {
      dateMatches.forEach(dateStr => {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= new Date().getFullYear()) {
          detectedDates.push(parsed);
        }
      });
    }

    const detectedTimes: string[] = [];
    const timeMatches = fullContent.match(timeRegex);
    if (timeMatches) {
      detectedTimes.push(...timeMatches);
    }

    // Generate suggested title
    let suggestedTitle = emailContent.subject || 'Meeting';
    if (meetingType !== 'meeting') {
      suggestedTitle = `${meetingType.charAt(0).toUpperCase()}${meetingType.slice(1)} - ${suggestedTitle}`;
    }

    // Check if it's a follow-up
    const isFollowUp = fullContent.includes('follow up') || 
                      fullContent.includes('following up') || 
                      fullContent.includes('check in');

    return {
      hasMeetingRequest: true,
      suggestedTitle,
      suggestedDuration,
      detectedDates: detectedDates as readonly Date[],
      detectedTimes: detectedTimes as readonly string[],
      isFollowUp,
      meetingType,
    };
  }
}

export function createGoogleCalendarClient(config: GoogleCalendarConfig): GoogleCalendarClient {
  return new GoogleCalendarClient(config);
}