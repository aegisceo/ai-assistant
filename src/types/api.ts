// Import the types we need
import type { EmailCategory, EmailClassification } from './index';

// Gmail API Types
export interface GmailMessage {
  readonly id: string;
  readonly threadId: string;
  readonly labelIds: readonly string[];
  readonly snippet: string;
  readonly historyId: string;
  readonly internalDate: string;
  readonly payload: GmailPayload;
  readonly sizeEstimate: number;
}

export interface GmailPayload {
  readonly partId: string;
  readonly mimeType: string;
  readonly filename: string;
  readonly headers: readonly GmailHeader[];
  readonly body: GmailBody;
  readonly parts?: readonly GmailPayload[];
}

export interface GmailHeader {
  readonly name: string;
  readonly value: string;
}

export interface GmailBody {
  readonly attachmentId?: string;
  readonly size: number;
  readonly data?: string;
}

// OpenAI API Types
export interface OpenAIClassificationRequest {
  readonly emailContent: string;
  readonly userContext: string;
  readonly priorityCategories: readonly EmailCategory[];
  readonly previousClassifications?: readonly EmailClassification[];
}

export interface OpenAIClassificationResponse {
  readonly classification: EmailClassification;
  readonly processingTime: number;
  readonly tokensUsed: number;
}

// Gmail Authentication Types
export interface GmailAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface GmailTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly scope: string;
  readonly tokenType: string;
  readonly expiryDate: number;
}

// Supabase Database Types
export interface Database {
  public: {
    Tables: {
      emails: {
        Row: {
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
        };
        Insert: Partial<Database['public']['Tables']['emails']['Row']>;
        Update: Partial<Database['public']['Tables']['emails']['Row']>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          email_classification_enabled: boolean;
          auto_unsubscribe_enabled: boolean;
          priority_categories: readonly EmailCategory[];
          working_hours: {
            readonly start: string;
            readonly end: string;
            readonly days: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
          };
          notification_settings: {
            readonly urgent_emails: boolean;
            readonly upcoming_events: boolean;
            readonly missed_opportunities: boolean;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['user_preferences']['Row']>;
        Update: Partial<Database['public']['Tables']['user_preferences']['Row']>;
      };
      gmail_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          scope: string;
          token_type: string;
          expiry_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['gmail_tokens']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['gmail_tokens']['Insert']>;
      };
      meeting_detections: {
        Row: {
          id: string;
          user_id: string;
          total_emails_processed: number;
          meetings_detected: number;
          high_priority_meetings: number;
          meeting_types: Record<string, number>;
          detection_timestamp: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['meeting_detections']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['meeting_detections']['Insert']>;
      };
      notification_logs: {
        Row: {
          id: string;
          user_id: string;
          check_type: string;
          notifications_count: number;
          total_emails_checked: number;
          check_parameters: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notification_logs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['notification_logs']['Insert']>;
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string;
          title: string;
          start_time: string;
          end_time: string;
          location: string | null;
          attendees_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calendar_events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>;
      };
      feedback_logs: {
        Row: {
          id: string;
          user_id: string;
          email_id: string;
          original_classification: Record<string, unknown>;
          user_correction: Record<string, unknown>;
          feedback_type: string;
          user_comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feedback_logs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['feedback_logs']['Insert']>;
      };
      oauth_states: {
        Row: {
          id: string;
          user_id: string;
          state: string;
          expires_at: string;
          provider: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['oauth_states']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['oauth_states']['Insert']>;
      };
      classification_progress: {
        Row: {
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
        };
        Insert: Partial<Database['public']['Tables']['classification_progress']['Row']>;
        Update: Partial<Database['public']['Tables']['classification_progress']['Row']>;
      };
      email_classifications: {
        Row: {
          id: string;
          user_id: string;
          email_id: string;
          classification: Record<string, unknown>;
          confidence_score: number;
          processed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_classifications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['email_classifications']['Insert']>;
      };
    };
  };
}
