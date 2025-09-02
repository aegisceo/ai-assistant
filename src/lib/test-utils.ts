/**
 * Test utilities for Gmail integration
 * Provides mock data and test helpers for development and testing
 */

import { Email, EmailAddress, EmailClassification } from '@/types';
import { GmailTokens } from '@/integrations/gmail';

/**
 * Generate mock Gmail tokens for testing
 */
export function createMockGmailTokens(): GmailTokens {
  return {
    accessToken: 'mock_access_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
    tokenType: 'Bearer',
    expiryDate: Date.now() + 3600000, // 1 hour from now
  };
}

/**
 * Generate mock email addresses
 */
export function createMockEmailAddress(
  email?: string,
  name?: string
): EmailAddress {
  return {
    email: email ?? `user${Date.now()}@example.com`,
    name: name ?? `Test User ${Date.now()}`,
  };
}

/**
 * Generate mock email data for testing
 */
export function createMockEmail(overrides?: Partial<Email>): Email {
  const baseEmail: Email = {
    id: `mock_email_${Date.now()}`,
    threadId: `thread_${Date.now()}`,
    subject: 'Test Email Subject',
    sender: createMockEmailAddress('sender@example.com', 'Test Sender'),
    recipients: [
      createMockEmailAddress('recipient1@example.com', 'Recipient 1'),
      createMockEmailAddress('recipient2@example.com', 'Recipient 2'),
    ],
    date: new Date(),
    snippet: 'This is a test email snippet...',
    bodyText: 'This is the plain text body of the test email.',
    bodyHtml: '<p>This is the <strong>HTML</strong> body of the test email.</p>',
    isRead: false,
    isImportant: false,
    labels: ['INBOX', 'UNREAD'],
  };

  return { ...baseEmail, ...overrides };
}

/**
 * Generate mock email classification for testing
 */
export function createMockEmailClassification(
  overrides?: Partial<EmailClassification>
): EmailClassification {
  const baseClassification: EmailClassification = {
    urgency: 3,
    importance: 3,
    actionRequired: false,
    category: 'work',
    confidence: 0.85,
    reasoning: 'Test classification reasoning',
  };

  return { ...baseClassification, ...overrides };
}

/**
 * Generate multiple mock emails for testing pagination and bulk operations
 */
export function createMockEmailBatch(count: number, category?: string): readonly Email[] {
  return Array.from({ length: count }, (_, index) => 
    createMockEmail({
      id: `batch_email_${index}_${Date.now()}`,
      subject: `${category ?? 'Test'} Email ${index + 1}`,
      sender: createMockEmailAddress(
        `sender${index}@example.com`, 
        `Sender ${index + 1}`
      ),
      isRead: index % 2 === 0, // Alternate read/unread
      isImportant: index % 5 === 0, // Every 5th email is important
      labels: index % 3 === 0 ? ['INBOX', 'IMPORTANT'] : ['INBOX'],
    })
  );
}

/**
 * Create test scenarios for different email types
 */
export const EMAIL_TEST_SCENARIOS = {
  urgent: createMockEmail({
    subject: 'URGENT: Server Down - Immediate Action Required',
    sender: createMockEmailAddress('alerts@company.com', 'System Alerts'),
    isImportant: true,
    labels: ['INBOX', 'IMPORTANT', 'UNREAD'],
  }),

  newsletter: createMockEmail({
    subject: 'Weekly Newsletter: Latest Updates',
    sender: createMockEmailAddress('newsletter@company.com', 'Company Newsletter'),
    bodyText: 'Check out our latest updates and news...',
    labels: ['INBOX', 'NEWSLETTER'],
  }),

  opportunity: createMockEmail({
    subject: 'Job Opportunity: Senior Developer Position',
    sender: createMockEmailAddress('hr@techcorp.com', 'TechCorp HR'),
    bodyText: 'We have an exciting opportunity for a senior developer...',
    labels: ['INBOX', 'UNREAD'],
  }),

  spam: createMockEmail({
    subject: 'Get rich quick! Amazing opportunity!!!',
    sender: createMockEmailAddress('noreply@spammer.com'),
    bodyText: 'Make $5000 a day working from home...',
    labels: ['SPAM'],
  }),

  personal: createMockEmail({
    subject: 'Family dinner this Sunday',
    sender: createMockEmailAddress('mom@family.com', 'Mom'),
    bodyText: 'Don\'t forget about family dinner this Sunday at 6 PM.',
    labels: ['INBOX'],
  }),
} as const;

/**
 * Test helper to validate email structure
 */
export function isValidEmail(email: unknown): email is Email {
  if (typeof email !== 'object' || email === null) return false;
  
  const e = email as Record<string, unknown>;
  
  return (
    typeof e['id'] === 'string' &&
    typeof e['threadId'] === 'string' &&
    (typeof e['subject'] === 'string' || e['subject'] === null) &&
    typeof e['sender'] === 'object' &&
    Array.isArray(e['recipients']) &&
    e['date'] instanceof Date &&
    typeof e['snippet'] === 'string' &&
    (typeof e['bodyText'] === 'string' || e['bodyText'] === null) &&
    (typeof e['bodyHtml'] === 'string' || e['bodyHtml'] === null) &&
    typeof e['isRead'] === 'boolean' &&
    typeof e['isImportant'] === 'boolean' &&
    Array.isArray(e['labels'])
  );
}

/**
 * Test helper to validate Gmail tokens structure
 */
export function isValidGmailTokens(tokens: unknown): tokens is GmailTokens {
  if (typeof tokens !== 'object' || tokens === null) return false;
  
  const t = tokens as Record<string, unknown>;
  
  return (
    typeof t['accessToken'] === 'string' &&
    typeof t['refreshToken'] === 'string' &&
    typeof t['scope'] === 'string' &&
    typeof t['tokenType'] === 'string' &&
    typeof t['expiryDate'] === 'number'
  );
}