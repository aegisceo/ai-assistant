// Import the types we need
import type { EmailCategory, EmailClassification, UserPreferences } from './index';

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
        Insert: Omit<Database['public']['Tables']['emails']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['emails']['Insert']>;
      };
      user_preferences: {
        Row: UserPreferences & {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
      };
    };
  };
}
