/**
 * Type-safe API client for Gmail integration
 * Handles authentication, error handling, and response parsing
 */

import { Result } from '@/lib/types';
import { Email } from '@/types';

/**
 * Gmail API response types
 */
export interface GmailStatusResponse {
  readonly isConnected: boolean;
  readonly isExpired: boolean;
  readonly scopes: readonly string[];
  readonly connectedAt: string | null;
  readonly expiresAt: string | null;
}

export interface GmailAuthResponse {
  readonly authUrl: string;
}

export interface GmailEmailsResponse {
  readonly emails: readonly Email[];
  readonly nextPageToken?: string;
  readonly totalEstimate: number;
}

export interface ClassifyEmailRequest {
  readonly email: Email;
  readonly userPreferences?: {
    readonly emailClassificationEnabled: boolean;
    readonly autoUnsubscribeEnabled: boolean;
    readonly priorityCategories: readonly string[];
    readonly workingHours: {
      readonly start: string;
      readonly end: string;
      readonly days: readonly number[];
    };
    readonly notificationSettings: {
      readonly urgentEmails: boolean;
      readonly upcomingEvents: boolean;
      readonly missedOpportunities: boolean;
    };
  };
}

export interface ClassifyEmailResponse {
  readonly classification: {
    readonly urgency: 1 | 2 | 3 | 4 | 5;
    readonly importance: 1 | 2 | 3 | 4 | 5;
    readonly actionRequired: boolean;
    readonly category: string;
    readonly confidence: number;
    readonly reasoning: string;
  };
  readonly suggestions: readonly string[];
  readonly metadata: {
    readonly processingTimeMs: number;
    readonly tokensUsed: number;
    readonly confidenceBreakdown: Record<string, number>;
  };
}

export interface FetchEmailsParams {
  readonly maxResults?: number;
  readonly labelIds?: string;
  readonly includeSpamTrash?: boolean;
  readonly query?: string;
  readonly pageToken?: string;
}

/**
 * API Client class with type-safe methods
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: () => string | null;

  constructor(
    baseUrl: string = '',
    getAuthToken: () => string | null
  ) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Result<T, Error>> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        error: new Error('No authentication token available'),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: new Error(`API Error (${response.status}): ${errorText}`),
        };
      }

      const data = await response.json() as { success: boolean; data?: T; error?: string };
      
      if (data.success && data.data !== undefined) {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: new Error(data.error ?? 'Unknown API error'),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Network error'),
      };
    }
  }

  /**
   * Get Gmail connection status
   */
  async getGmailStatus(): Promise<Result<GmailStatusResponse, Error>> {
    return this.request<GmailStatusResponse>('/api/gmail/status');
  }

  /**
   * Initiate Gmail OAuth flow
   */
  async initiateGmailAuth(): Promise<Result<GmailAuthResponse, Error>> {
    return this.request<GmailAuthResponse>('/api/gmail/auth');
  }

  /**
   * Disconnect Gmail account
   */
  async disconnectGmail(): Promise<Result<{ message: string }, Error>> {
    return this.request<{ message: string }>('/api/gmail/status', {
      method: 'DELETE',
    });
  }

  /**
   * Fetch emails from Gmail
   */
  async fetchGmailEmails(
    params: FetchEmailsParams = {}
  ): Promise<Result<GmailEmailsResponse, Error>> {
    const searchParams = new URLSearchParams();
    
    if (params.maxResults !== undefined) {
      searchParams.set('maxResults', params.maxResults.toString());
    }
    if (params.labelIds !== undefined && params.labelIds.length > 0) {
      searchParams.set('labelIds', params.labelIds);
    }
    if (params.includeSpamTrash !== undefined) {
      searchParams.set('includeSpamTrash', params.includeSpamTrash.toString());
    }
    if (params.query !== undefined && params.query.length > 0) {
      searchParams.set('query', params.query);
    }
    if (params.pageToken !== undefined && params.pageToken.length > 0) {
      searchParams.set('pageToken', params.pageToken);
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/gmail/emails${queryString.length > 0 ? `?${queryString}` : ''}`;

    return this.request<GmailEmailsResponse>(endpoint);
  }

  /**
   * Classify an email with AI
   */
  async classifyEmail(
    request: ClassifyEmailRequest
  ): Promise<Result<ClassifyEmailResponse, Error>> {
    // Convert Email object to API format
    const emailData = {
      ...request.email,
      date: request.email.date.toISOString(),
    };

    return this.request<ClassifyEmailResponse>('/api/classify/email', {
      method: 'POST',
      body: JSON.stringify({
        email: emailData,
        userPreferences: request.userPreferences,
      }),
    });
  }
}

/**
 * Create API client instance with Supabase authentication
 */
export function createApiClient(): ApiClient {
  // Create a sync wrapper for the async token getter
  const syncGetAuthToken = (): string | null => {
    if (typeof window !== 'undefined') {
      // Try to get the token from the current session if available
      // This is a best-effort approach for synchronous access
      const sessionData = localStorage.getItem('sb-cmbnexhzuoydobsevplb-auth-token');
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          return parsed.access_token;
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  return new ApiClient('', syncGetAuthToken);
}