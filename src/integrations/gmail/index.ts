// Gmail Integration Module
// Provides complete Gmail API integration with OAuth2 authentication and email management

export {
  GmailClient,
  GmailIntegrationError,
  type GmailAuthConfig,
  type GmailTokens,
  type FetchEmailsOptions,
  type FetchEmailsResult,
} from './client';

export {
  SupabaseGmailAuthService,
  createGmailAuthService,
  type GmailAuthService,
  type StoredGmailTokens,
} from './auth';

// Re-export relevant types from API types
export type {
  GmailMessage,
  GmailPayload,
  GmailHeader,
  GmailBody,
} from '@/types/api';