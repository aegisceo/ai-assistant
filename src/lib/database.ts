/**
 * Database service layer with proper typing
 * Handles database operations with type safety while avoiding complex Supabase type issues
 */

import { createClient } from '@/lib/supabase/server';
import { UserPreferences, EmailClassification } from '@/types';

export interface DbUserPreferences {
  id: string;
  user_id: string;
  email_classification_enabled: boolean;
  auto_unsubscribe_enabled: boolean;
  priority_categories: string[];
  working_hours: {
    start: string;
    end: string;
    days: number[];
  };
  notification_settings: {
    urgent_emails: boolean;
    upcoming_events: boolean;
    missed_opportunities: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface DbEmail {
  id: string;
  user_id: string;
  gmail_id: string;
  subject: string | null;
  sender_email: string;
  sender_name: string | null;
  received_at: string;
  classification: EmailClassification | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbClassificationProgress {
  id: string;
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
  created_at: string;
}

export class DatabaseService {
  private getClient() {
    return createClient();
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await (this.getClient() as any)
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch user preferences: ${error.message}`);
      }

      if (!data) return null;

      const dbPrefs = data as DbUserPreferences;
      return {
        emailClassificationEnabled: dbPrefs.email_classification_enabled,
        autoUnsubscribeEnabled: dbPrefs.auto_unsubscribe_enabled,
        priorityCategories: dbPrefs.priority_categories as UserPreferences['priorityCategories'],
        workingHours: {
          start: dbPrefs.working_hours.start,
          end: dbPrefs.working_hours.end,
          days: dbPrefs.working_hours.days as UserPreferences['workingHours']['days'],
        },
        notificationSettings: {
          urgentEmails: dbPrefs.notification_settings.urgent_emails,
          upcomingEvents: dbPrefs.notification_settings.upcoming_events,
          missedOpportunities: dbPrefs.notification_settings.missed_opportunities,
        },
      };
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  async upsertUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    const dbData = {
      user_id: userId,
      email_classification_enabled: preferences.emailClassificationEnabled,
      auto_unsubscribe_enabled: preferences.autoUnsubscribeEnabled,
      priority_categories: preferences.priorityCategories,
      working_hours: preferences.workingHours,
      notification_settings: preferences.notificationSettings,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (this.getClient() as any)
      .from('user_preferences')
      .upsert(dbData, {
        onConflict: 'user_id'
      });

    if (error) {
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }
  }

  async upsertClassificationProgress(progress: Partial<DbClassificationProgress>): Promise<void> {
    const { error } = await (this.getClient() as any)
      .from('classification_progress')
      .upsert({
        updated_at: new Date().toISOString(),
        ...progress,
      }, {
        onConflict: 'session_id,user_id'
      });

    if (error) {
      throw new Error(`Failed to update classification progress: ${error.message}`);
    }
  }

  async upsertEmails(emails: Partial<DbEmail>[]): Promise<void> {
    if (emails.length === 0) return;

    const { error } = await (this.getClient() as any)
      .from('emails')
      .upsert(emails, {
        onConflict: 'user_id,gmail_id'
      });

    if (error) {
      throw new Error(`Failed to store emails: ${error.message}`);
    }
  }
}

export const dbService = new DatabaseService();