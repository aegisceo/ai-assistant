/**
 * Calendar Integration Component
 * Displays upcoming events and provides meeting detection/scheduling functionality
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useApi, useAsyncOperation } from '@/lib/hooks';
import { CalendarEvent, Email } from '@/types';

export interface CalendarIntegrationProps {
  readonly emails?: Email[];
  readonly showMeetingDetection?: boolean;
  readonly maxEvents?: number;
}

interface MeetingDetection {
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
}

interface EventFormData {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  attendees: string;
}

export function CalendarIntegration({
  emails = [],
  showMeetingDetection = true,
  maxEvents: _maxEvents = 10
}: CalendarIntegrationProps): React.ReactElement {
  const [selectedTab, setSelectedTab] = useState<'events' | 'meetings' | 'schedule'>('events');
  const [_showEventForm, _setShowEventForm] = useState(false);
  const [eventFormData, setEventFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start: '',
    end: '',
    location: '',
    attendees: '',
  });

  // Check Gmail status to see if we have calendar permissions
  const { 
    data: gmailStatus, 
    loading: gmailStatusLoading,
    error: _gmailStatusError,
    refetch: _refetchGmailStatus
  } = useApi(
    async () => {
      const response = await fetch('/api/gmail/status', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json() as { success: boolean; data?: any; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Gmail status');
      }
      return { success: true, data: result.data };
    },
    []
  );

  const hasCalendarScope = gmailStatus?.isConnected && 
    gmailStatus.scopes.some((scope: string) => scope.includes('calendar'));

  // Fetch upcoming calendar events
  const { 
    data: eventsResponse, 
    loading: eventsLoading, 
    error: eventsError, 
    refetch: refetchEvents 
  } = useApi(
    async () => {
      try {
        if (!hasCalendarScope) {
          return { success: true, data: { events: [] } };
        }
        const response = await fetch('/api/calendar/events', {
          credentials: 'include',
        });
        if (!response.ok) {
          return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
      }
    },
    [hasCalendarScope]
  );

  // Meeting detection functionality
  const [meetingDetections, setMeetingDetections] = useState<any>(null);
  const { 
    loading: detectionsLoading, 
    execute: detectMeetingsRaw 
  } = useAsyncOperation(
    (emailsToAnalyze: Email[]) => fetch('/api/calendar/detect-meetings', {
      method: 'POST',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails: emailsToAnalyze.slice(0, 20), // Limit to 20 emails for performance
        suggestTimeSlots: true,
      }),
    }).then(async res => {
      if (!res.ok) {
        return { success: false as const, error: new Error(`HTTP ${res.status}: ${res.statusText}`) };
      }
      const result = await res.json();
      return { success: true as const, data: result };
    }).catch(error => {
      return { success: false as const, error: error instanceof Error ? error : new Error('Unknown error') };
    })
  );

  const detectMeetings = async (emailsToAnalyze: Email[]) => {
    const result = await detectMeetingsRaw(emailsToAnalyze);
    if (result) {
      setMeetingDetections(result);
    }
    return result;
  };

  // Event creation functionality
  const { 
    loading: createLoading, 
    execute: createEvent 
  } = useAsyncOperation(
    (eventData: Omit<EventFormData, 'attendees'> & { attendees: string[] }) => fetch('/api/calendar/events', {
      method: 'POST',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }).then(async res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
  );

  // Run meeting detection when emails are available
  React.useEffect(() => {
    if (showMeetingDetection && emails.length > 0 && selectedTab === 'meetings') {
      void detectMeetings(emails);
    }
  }, [showMeetingDetection, emails, selectedTab, detectMeetings]);

  const handleCreateEvent = useCallback(async (): Promise<void> => {
    if (!eventFormData.title || !eventFormData.start || !eventFormData.end) {
      alert('Please fill in required fields (title, start time, end time)');
      return;
    }

    const attendeesList = eventFormData.attendees
      .split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0 && email.includes('@'));

    const result = await createEvent({
      title: eventFormData.title,
      description: eventFormData.description,
      start: eventFormData.start,
      end: eventFormData.end,
      location: eventFormData.location,
      attendees: attendeesList,
    });

    if (result) {
      _setShowEventForm(false);
      setEventFormData({
        title: '',
        description: '',
        start: '',
        end: '',
        location: '',
        attendees: '',
      });
      void refetchEvents();
    }
  }, [eventFormData, createEvent, refetchEvents]);

  const handleScheduleMeeting = useCallback(async (detection: MeetingDetection, timeSlot?: { start: Date; end: Date }): Promise<void> => {
    if (!detection.suggestedEvent) return;

    const startTime = timeSlot?.start || new Date();
    const endTime = timeSlot?.end || new Date(startTime.getTime() + (detection.detection.suggestedDuration || 30) * 60000);

    // Pre-populate form with suggestion
    setEventFormData({
      title: detection.suggestedEvent.title,
      description: detection.suggestedEvent.description,
      start: startTime.toISOString().slice(0, 16),
      end: endTime.toISOString().slice(0, 16),
      location: '',
      attendees: detection.suggestedEvent.attendees.join(', '),
    });
    setSelectedTab('schedule');
    _setShowEventForm(true);
  }, []);

  const formatDateTime = (date: Date): string => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    let dateStr = '';
    if (isToday) {
      dateStr = 'Today';
    } else if (isTomorrow) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  const getEventStatusColor = (status: CalendarEvent['status']): string => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'tentative': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="calendar-integration bg-white rounded-lg shadow-md">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setSelectedTab('events')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'events'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            type="button"
          >
            📅 Upcoming Events
          </button>
          {showMeetingDetection && (
            <button
              onClick={() => setSelectedTab('meetings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'meetings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              type="button"
            >
              🤖 Meeting Detection
              {meetingDetections?.data && meetingDetections.data.summary.meetingRequestsFound > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                  {meetingDetections.data.summary.meetingRequestsFound}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setSelectedTab('schedule')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            type="button"
          >
            ➕ Schedule Event
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Upcoming Events Tab */}
        {selectedTab === 'events' && (
          <div className="events-tab">
            {/* Calendar Permissions Check */}
            {!gmailStatusLoading && !hasCalendarScope && (
              <div className="calendar-permissions-notice bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-amber-800 font-medium">Calendar Access Required</h3>
                    <p className="text-amber-700 text-sm mt-1">
                      To view your calendar events and schedule meetings, you need to reconnect Gmail with calendar permissions.
                    </p>
                    <div className="mt-3">
                      <p className="text-xs text-amber-600 mb-2">
                        Current permissions: {gmailStatus?.scopes?.map((scope: string) => scope.replace('https://www.googleapis.com/auth/', '')).join(', ') || 'None'}
                      </p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-amber-600">Go to Gmail Connection section and click &quot;Disconnect&quot; then &quot;Connect&quot; to get calendar access.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {eventsLoading && hasCalendarScope && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading calendar events...</p>
              </div>
            )}

            {eventsError && (
              <div className="error-state bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Error loading calendar</p>
                <p className="text-red-600 text-sm mt-1">{eventsError.message}</p>
                <button
                  onClick={() => void refetchEvents()}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                  type="button"
                >
                  Try Again
                </button>
              </div>
            )}

            {eventsResponse?.data && hasCalendarScope && (
              <div className="events-list">
                {eventsResponse.data.events.length === 0 ? (
                  <div className="empty-state text-center py-8">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-gray-600">No upcoming events in your calendar.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eventsResponse.data.events.map((event: any) => (
                      <div
                        key={event.id}
                        className={`event-item p-4 border rounded-lg ${getEventStatusColor(event.status)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{event.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateTime(event.start)} - {formatDateTime(event.end)}
                            </p>
                            {event.location && (
                              <p className="text-sm text-gray-600 mt-1">
                                📍 {event.location}
                              </p>
                            )}
                            {event.attendees.length > 0 && (
                              <p className="text-sm text-gray-600 mt-1">
                                👥 {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
                              </p>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 ml-4">
                            <span className="px-2 py-1 text-xs font-medium rounded-full capitalize">
                              {event.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Meeting Detection Tab */}
        {selectedTab === 'meetings' && showMeetingDetection && (
          <div className="meetings-tab">
            {detectionsLoading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Analyzing emails for meeting requests...</p>
              </div>
            )}

            {meetingDetections?.data && (
              <div className="meeting-detections">
                {/* Summary */}
                <div className="summary-panel mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">📊 Meeting Analysis</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat">
                      <div className="text-2xl font-bold text-blue-600">
                        {meetingDetections.data.summary.meetingRequestsFound}
                      </div>
                      <div className="text-sm text-gray-600">Meeting Requests</div>
                    </div>
                    <div className="stat">
                      <div className="text-2xl font-bold text-red-600">
                        {meetingDetections.data.summary.highPriorityMeetings}
                      </div>
                      <div className="text-sm text-gray-600">High Priority</div>
                    </div>
                    <div className="stat">
                      <div className="text-2xl font-bold text-green-600">
                        {meetingDetections.data.insights.urgentMeetings}
                      </div>
                      <div className="text-sm text-gray-600">Urgent</div>
                    </div>
                    <div className="stat">
                      <div className="text-2xl font-bold text-purple-600">
                        {Object.keys(meetingDetections.data.summary.meetingTypeBreakdown).length}
                      </div>
                      <div className="text-sm text-gray-600">Meeting Types</div>
                    </div>
                  </div>

                  {meetingDetections.data.insights.recommendations.length > 0 && (
                    <div className="recommendations mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">💡 Recommendations:</h4>
                      <ul className="space-y-1">
                        {meetingDetections.data.insights.recommendations.map((rec: any, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Meeting Detections */}
                <div className="detections-list space-y-4">
                  {meetingDetections.data.detections
                    .filter((d: any) => d.detection.hasMeetingRequest)
                    .map((detection: any) => (
                      <div
                        key={detection.emailId}
                        className="detection-item p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {detection.detection.suggestedTitle}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                              {detection.detection.meetingType && (
                                <span className="capitalize">{detection.detection.meetingType}</span>
                              )}
                              {detection.detection.suggestedDuration && (
                                <span>{detection.detection.suggestedDuration} minutes</span>
                              )}
                              {detection.detection.isFollowUp && (
                                <span className="text-blue-600">Follow-up</span>
                              )}
                            </div>
                          </div>
                          {detection.suggestedEvent && (
                            <div className={`priority-badge px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(detection.suggestedEvent.priority)}`}>
                              {detection.suggestedEvent.priority}
                            </div>
                          )}
                        </div>

                        {detection.suggestedEvent && (
                          <div className="suggested-event">
                            <p className="text-sm text-gray-700 mb-2">
                              <span className="font-medium">Attendees:</span> {detection.suggestedEvent.attendees.join(', ')}
                            </p>

                            {detection.suggestedEvent.suggestedTimes && detection.suggestedEvent.suggestedTimes.length > 0 && (
                              <div className="suggested-times mb-3">
                                <p className="text-sm font-medium text-gray-900 mb-2">Suggested Times:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {detection.suggestedEvent.suggestedTimes.slice(0, 4).map((timeSlot: any, index: number) => (
                                    <button
                                      key={index}
                                      onClick={() => void handleScheduleMeeting(detection, timeSlot)}
                                      className="time-slot p-2 text-left border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300"
                                      type="button"
                                    >
                                      <div className="text-sm font-medium">
                                        {formatDateTime(timeSlot.start)}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Confidence: {Math.round(timeSlot.confidence * 100)}%
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => void handleScheduleMeeting(detection)}
                              className="schedule-button px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                              type="button"
                            >
                              Schedule Meeting
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {meetingDetections?.data && meetingDetections.data.summary.meetingRequestsFound === 0 && (
              <div className="empty-state text-center py-8">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-600">No meeting requests detected in recent emails.</p>
                <p className="text-sm text-gray-500 mt-2">
                  I analyze emails for scheduling keywords and meeting requests.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Event Tab */}
        {selectedTab === 'schedule' && (
          <div className="schedule-tab">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Event</h3>
            
            <div className="event-form space-y-4">
              <div className="form-group">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meeting title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Meeting description or agenda"
                />
              </div>

              <div className="form-row grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="start" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    id="start"
                    type="datetime-local"
                    value={eventFormData.start}
                    onChange={(e) => setEventFormData(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end" className="block text-sm font-medium text-gray-700 mb-1">
                    End Time *
                  </label>
                  <input
                    id="end"
                    type="datetime-local"
                    value={eventFormData.end}
                    onChange={(e) => setEventFormData(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={eventFormData.location}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meeting location or video call link"
                />
              </div>

              <div className="form-group">
                <label htmlFor="attendees" className="block text-sm font-medium text-gray-700 mb-1">
                  Attendees
                </label>
                <input
                  id="attendees"
                  type="text"
                  value={eventFormData.attendees}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, attendees: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email addresses separated by commas"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter email addresses separated by commas
                </p>
              </div>

              <div className="form-actions flex justify-end space-x-3">
                <button
                  onClick={() => {
                    _setShowEventForm(false);
                    setEventFormData({
                      title: '',
                      description: '',
                      start: '',
                      end: '',
                      location: '',
                      attendees: '',
                    });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateEvent()}
                  disabled={createLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  type="button"
                >
                  {createLoading ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}