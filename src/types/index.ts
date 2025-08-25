// Email Types
export interface Email {
  readonly id: string;
  readonly threadId: string;
  readonly subject: string | null;
  readonly sender: EmailAddress;
  readonly recipients: readonly EmailAddress[];
  readonly date: Date;
  readonly snippet: string;
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  readonly isRead: boolean;
  readonly isImportant: boolean;
  readonly labels: readonly string[];
}

export interface EmailAddress {
  readonly email: string;
  readonly name?: string;
}

// AI Classification Types
export interface EmailClassification {
  readonly urgency: 1 | 2 | 3 | 4 | 5;
  readonly importance: 1 | 2 | 3 | 4 | 5;
  readonly actionRequired: boolean;
  readonly category: EmailCategory;
  readonly confidence: number; // 0-1
  readonly reasoning?: string;
}

export type EmailCategory = 
  | 'work'
  | 'personal'
  | 'financial'
  | 'opportunity'
  | 'newsletter'
  | 'spam'
  | 'other';

// Calendar Types
export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly description?: string;
  readonly location?: string;
  readonly attendees: readonly EventAttendee[];
  readonly isAllDay: boolean;
  readonly status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface EventAttendee {
  readonly email: string;
  readonly name?: string;
  readonly responseStatus: 'accepted' | 'declined' | 'needsAction' | 'tentative';
}

// API Response Types
export interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly success: boolean;
}

// User Preferences
export interface UserPreferences {
  readonly emailClassificationEnabled: boolean;
  readonly autoUnsubscribeEnabled: boolean;
  readonly priorityCategories: readonly EmailCategory[];
  readonly workingHours: WorkingHours;
  readonly notificationSettings: NotificationSettings;
}

export interface WorkingHours {
  readonly start: string; // HH:MM format
  readonly end: string;   // HH:MM format
  readonly days: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[]; // 0 = Sunday
}

export interface NotificationSettings {
  readonly urgentEmails: boolean;
  readonly upcomingEvents: boolean;
  readonly missedOpportunities: boolean;
}

// Re-export all types from other modules for convenience
export * from './api';
export * from './errors';
export * from './test';
