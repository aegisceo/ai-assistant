// AI Patterns for the AI Assistant with strict TypeScript typing
import type {
  Email,
  EmailCategory,
  EmailClassification,
  UserPreferences
} from '@/types';
import {
  ClassificationError,
  ClassificationTimeoutError,
  RateLimitError
} from '@/types/errors';
import type { Result } from './types';

// Type-safe AI classification patterns
export interface ClassificationContext {
  readonly userPreferences: UserPreferences;
  readonly recentClassifications: readonly EmailClassification[];
  readonly workingHours: { readonly start: string; readonly end: string };
  readonly timezone: string;
}

/**
 * Classifies an email using OpenAI with strict typing and error handling
 * @param email - The email to classify
 * @param context - User context and preferences
 * @param options - Classification options
 * @returns Promise resolving to classification result or error
 */
export async function classifyEmailWithAI(
  _email: Pick<Email, 'subject' | 'bodyText' | 'sender' | 'date'>,
  _context: ClassificationContext,
  _options: {
    readonly timeoutMs: number;
    readonly maxRetries: number;
    readonly model: 'gpt-4' | 'gpt-3.5-turbo';
  }
): Promise<Result<EmailClassification, ClassificationError | ClassificationTimeoutError | RateLimitError>> {
  try {
    // Implementation would call OpenAI API here
    // For now, return a mock successful result
    const mockClassification: EmailClassification = {
      urgency: 3,
      importance: 4,
      actionRequired: true,
      category: 'work',
      confidence: 0.85,
      reasoning: 'Email contains actionable work content'
    };

    return { success: true, data: mockClassification };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: new ClassificationError(
          'Failed to classify email with AI',
          'mock-email-id' as any, // In real implementation, use actual email ID
          'openai',
          error
        )
      };
    }

    return {
      success: false,
      error: new ClassificationError(
        'Unknown error during classification',
        'mock-email-id' as any,
        'openai',
        error
      )
    };
  }
}

// Type-safe email prioritization patterns
export interface PrioritizationRule {
  readonly name: string;
  readonly condition: (email: Email, context: ClassificationContext) => boolean;
  readonly priority: 1 | 2 | 3 | 4 | 5;
  readonly category: EmailCategory;
}

/**
 * Applies prioritization rules to an email
 * @param email - The email to prioritize
 * @param rules - Array of prioritization rules
 * @param context - User context
 * @returns Prioritized email classification
 */
export function applyPrioritizationRules(
  email: Email,
  rules: readonly PrioritizationRule[],
  context: ClassificationContext
): EmailClassification {
  let highestPriority: 1 | 2 | 3 | 4 | 5 = 3; // Default priority
  let selectedCategory: EmailCategory = 'other';
  let reasoning = 'Default classification';

  for (const rule of rules) {
    if (rule.condition(email, context)) {
      if (rule.priority < highestPriority) {
        highestPriority = rule.priority;
        selectedCategory = rule.category;
        reasoning = `Matched rule: ${rule.name}`;
      }
    }
  }

  return {
    urgency: highestPriority,
    importance: highestPriority,
    actionRequired: highestPriority <= 2,
    category: selectedCategory,
    confidence: 0.9,
    reasoning
  };
}

// Predefined prioritization rules
export const defaultPrioritizationRules: readonly PrioritizationRule[] = [
  {
    name: 'Urgent Work Email',
    condition: (email, context) => {
      const isWorkHours = context.workingHours.start <=
        email.date.toLocaleTimeString('en-US', { hour12: false }) &&
        email.date.toLocaleTimeString('en-US', { hour12: false }) <= context.workingHours.end;

      return email.sender.email.includes('@company.com') && isWorkHours;
    },
    priority: 1,
    category: 'work'
  },
  {
    name: 'Financial Email',
    condition: (email) =>
      (email.subject?.toLowerCase().includes('payment') ?? false) ||
      (email.subject?.toLowerCase().includes('invoice') ?? false) ||
      email.sender.email.includes('@bank.com'),
    priority: 2,
    category: 'financial'
  },
  {
    name: 'Opportunity Email',
    condition: (email) =>
      (email.subject?.toLowerCase().includes('opportunity') ?? false) ||
      (email.subject?.toLowerCase().includes('invitation') ?? false),
    priority: 2,
    category: 'opportunity'
  }
] as const;

// Type-safe calendar integration patterns
export interface CalendarIntegrationContext {
  readonly userId: string;
  readonly calendarId: string;
  readonly timezone: string;
  readonly workingHours: { readonly start: string; readonly end: string };
}

/**
 * Suggests optimal meeting times based on email urgency and user preferences
 * @param email - The email that might require a meeting
 * @param context - Calendar integration context
 * @param availableSlots - Available time slots
 * @returns Suggested meeting times
 */
export function suggestMeetingTimes(
  email: Email,
  context: CalendarIntegrationContext,
  availableSlots: readonly { readonly start: Date; readonly end: Date }[]
): readonly { readonly start: Date; readonly end: Date; readonly reason: string }[] {
  const suggestions: Array<{ readonly start: Date; readonly end: Date; readonly reason: string }> = [];

  // Filter slots within working hours
  const workingHourSlots = availableSlots.filter(slot => {
    const slotHour = slot.start.getHours();
    const startHourStr = context.workingHours.start.split(':')[0];
    const endHourStr = context.workingHours.end.split(':')[0];

    if (!startHourStr || !endHourStr) return false;

    const startHour = parseInt(startHourStr);
    const endHour = parseInt(endHourStr);

    return slotHour >= startHour && slotHour < endHour;
  });

  // Prioritize slots based on email urgency (simplified logic)
  const isUrgent = (email.subject?.toLowerCase().includes('urgent') ?? false) ||
    (email.subject?.toLowerCase().includes('asap') ?? false);

  if (isUrgent && workingHourSlots.length > 0) {
    // Suggest earliest available slot for urgent emails
    const firstSlot = workingHourSlots[0];
    if (firstSlot) {
      suggestions.push({
        start: firstSlot.start,
        end: firstSlot.end,
        reason: 'Urgent email - earliest available slot'
      });
    }
  }

  return suggestions;
}

// Type-safe email summarization patterns
export interface SummarizationOptions {
  readonly maxLength: number;
  readonly includeActionItems: boolean;
  readonly includeKeyPoints: boolean;
  readonly language: 'en' | 'es' | 'fr' | 'de';
}

/**
 * Generates a summary of an email with specified options
 * @param email - The email to summarize
 * @param options - Summarization options
 * @returns Email summary
 */
export function generateEmailSummary(
  email: Email,
  options: SummarizationOptions
): {
  readonly summary: string;
  readonly actionItems: readonly string[];
  readonly keyPoints: readonly string[];
  readonly wordCount: number;
} {
  const content = `${email.subject || 'No Subject'}\n\n${email.bodyText || ''}`;
  const words = content.split(/\s+/).filter(word => word.length > 0);

  // Simple summarization logic (in real implementation, use AI)
  const summary = words.slice(0, options.maxLength).join(' ');
  const actionItems: string[] = [];
  const keyPoints: string[] = [];

  // Extract action items (simplified)
  if (options.includeActionItems) {
    const actionKeywords = ['please', 'need', 'request', 'action', 'todo'];
    actionKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        actionItems.push(`Action required: ${keyword}`);
      }
    });
  }

  // Extract key points (simplified)
  if (options.includeKeyPoints) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    keyPoints.push(...sentences.slice(0, 3).map(s => s.trim()));
  }

  return {
    summary,
    actionItems,
    keyPoints,
    wordCount: words.length
  };
}

// Type-safe notification patterns
export interface NotificationRule {
  readonly type: 'email' | 'push' | 'sms';
  readonly condition: (email: Email, classification: EmailClassification) => boolean;
  readonly priority: 'low' | 'medium' | 'high';
  readonly delay?: number; // Delay in minutes
}

/**
 * Determines if a notification should be sent for an email
 * @param email - The email to evaluate
 * @param classification - The email classification
 * @param rules - Notification rules
 * @returns Notification decision
 */
export function shouldSendNotification(
  email: Email,
  classification: EmailClassification,
  rules: readonly NotificationRule[]
): readonly NotificationRule[] {
  return rules.filter(rule => rule.condition(email, classification));
}

// Default notification rules
export const defaultNotificationRules: readonly NotificationRule[] = [
  {
    type: 'push',
    condition: (_, classification) => classification.urgency <= 2,
    priority: 'high',
    delay: 0
  },
  {
    type: 'email',
    condition: (_, classification) => classification.urgency <= 3,
    priority: 'medium',
    delay: 15
  },
  {
    type: 'push',
    condition: (_, classification) => classification.category === 'financial',
    priority: 'high',
    delay: 0
  }
] as const;
