import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Result } from '@/lib/types';
import { Email, EmailAddress } from '@/types';

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

export class GmailIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GmailIntegrationError';
  }
}

export interface FetchEmailsOptions {
  readonly maxResults?: number;
  readonly labelIds?: readonly string[];
  readonly includeSpamTrash?: boolean;
  readonly query?: string;
  readonly pageToken?: string;
}

export interface FetchEmailsResult {
  readonly emails: readonly Email[];
  readonly nextPageToken?: string;
  readonly totalEstimate: number;
}

export class GmailClient {
  private readonly auth: OAuth2Client;
  private gmail: gmail_v1.Gmail | null = null;

  constructor(config: GmailAuthConfig) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }


  /**
   * Get the OAuth2 authorization URL for user consent with CSRF protection
   */
  getAuthUrl(state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<Result<GmailTokens, GmailIntegrationError>> {
    try {
      const { tokens } = await this.auth.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        return {
          success: false,
          error: new GmailIntegrationError(
            'Missing required tokens in response',
            'INVALID_TOKENS'
          ),
        };
      }

      return {
        success: true,
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          scope: tokens.scope ?? '',
          tokenType: tokens.token_type ?? 'Bearer',
          expiryDate: tokens.expiry_date ?? Date.now() + 3600000,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Failed to exchange code for tokens',
          'TOKEN_EXCHANGE_FAILED',
          error
        ),
      };
    }
  }

  /**
   * Set credentials for authenticated requests
   */
  setCredentials(tokens: GmailTokens): void {
    this.auth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      token_type: tokens.tokenType,
      expiry_date: tokens.expiryDate,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  /**
   * Fetch emails from Gmail
   */
  async fetchEmails(
    options: FetchEmailsOptions = {}
  ): Promise<Result<FetchEmailsResult, GmailIntegrationError>> {
    if (!this.gmail) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Gmail client not initialized. Call setCredentials first.',
          'CLIENT_NOT_INITIALIZED'
        ),
      };
    }

    try {
      const listParams: Record<string, unknown> = {
        userId: 'me',
        maxResults: options.maxResults ?? 50,
        includeSpamTrash: options.includeSpamTrash ?? false,
      };

      if (options.labelIds) {
        listParams['labelIds'] = options.labelIds as string[];
      }
      if (options.query) {
        listParams['q'] = options.query;
      }
      if (options.pageToken) {
        listParams['pageToken'] = options.pageToken;
      }

      const listResponse = await this.gmail.users.messages.list(listParams);
      const responseData = (listResponse as any).data;

      const messages = responseData?.messages ?? [];
      const emails: Email[] = [];

      // Fetch full email data for each message
      for (const message of messages) {
        if (!message.id) continue;

        const emailResult = await this.fetchSingleEmail(message.id);
        if (emailResult.success) {
          emails.push(emailResult.data);
        }
      }

      return {
        success: true,
        data: {
          emails,
          nextPageToken: responseData?.nextPageToken ?? undefined,
          totalEstimate: responseData?.resultSizeEstimate ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Failed to fetch emails',
          'FETCH_EMAILS_FAILED',
          error
        ),
      };
    }
  }

  /**
   * Fetch a single email by ID
   */
  private async fetchSingleEmail(messageId: string): Promise<Result<Email, GmailIntegrationError>> {
    if (!this.gmail) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Gmail client not initialized',
          'CLIENT_NOT_INITIALIZED'
        ),
      };
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message.id || !message.payload) {
        return {
          success: false,
          error: new GmailIntegrationError(
            'Invalid message format',
            'INVALID_MESSAGE_FORMAT'
          ),
        };
      }

      const email = this.parseGmailMessage(message);
      return { success: true, data: email };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          `Failed to fetch email ${messageId}`,
          'FETCH_EMAIL_FAILED',
          error
        ),
      };
    }
  }

  /**
   * Parse Gmail message into our Email format
   */
  private parseGmailMessage(message: gmail_v1.Schema$Message): Email {
    const headers = message.payload?.headers ?? [];
    const getHeader = (name: string): string | null => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value ?? null;
    };

    const parseAddresses = (addressString: string | null): readonly EmailAddress[] => {
      if (!addressString) return [];
      
      // Simple email parsing - in production, use a proper email parser
      const addresses = addressString.split(',').map(addr => {
        const match = addr.trim().match(/^(.+?)\s*<(.+?)>$/) ?? addr.trim().match(/^(.+)$/);
        if (match && match.length >= 2) {
          const email = match[2]?.trim() ?? match[1]?.trim() ?? '';
          const name = match[2] ? match[1]?.trim() : undefined;
          const result: EmailAddress = { email };
          if (name && name !== email) {
            (result as any).name = name;
          }
          return result;
        }
        return { email: addr.trim() };
      }).filter(addr => addr.email.length > 0);

      return addresses;
    };

    const sender = parseAddresses(getHeader('from'))[0] ?? { email: 'unknown@unknown.com' };
    const recipients = [
      ...parseAddresses(getHeader('to')),
      ...parseAddresses(getHeader('cc')),
      ...parseAddresses(getHeader('bcc')),
    ];

    // Extract body content
    const { bodyText, bodyHtml } = this.extractBodyContent(message.payload);

    // Parse date
    const dateHeader = getHeader('date');
    const date = dateHeader ? new Date(dateHeader) : new Date();

    return {
      id: message.id!,
      threadId: message.threadId ?? message.id!,
      subject: getHeader('subject'),
      sender,
      recipients,
      date,
      snippet: message.snippet ?? '',
      bodyText,
      bodyHtml,
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT') ?? false,
      labels: message.labelIds ?? [],
    };
  }

  /**
   * Extract body content from message payload
   */
  private extractBodyContent(payload: gmail_v1.Schema$MessagePart | undefined): {
    bodyText: string | null;
    bodyHtml: string | null;
  } {
    if (!payload) return { bodyText: null, bodyHtml: null };

    let bodyText: string | null = null;
    let bodyHtml: string | null = null;

    const extractFromPart = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      // Recursively check parts
      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    extractFromPart(payload);

    return { bodyText, bodyHtml };
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(): Promise<Result<boolean, GmailIntegrationError>> {
    try {
      await this.auth.getAccessToken();
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Failed to refresh access token',
          'TOKEN_REFRESH_FAILED',
          error
        ),
      };
    }
  }
}