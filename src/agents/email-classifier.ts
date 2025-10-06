/**
 * Email Classification Agent using Claude
 * Analyzes emails for urgency, importance, category, and actionability
 */

import { ClaudeClient, createClaudeClient, ClaudeIntegrationError } from './claude-client';
import { Email, EmailClassification, EmailCategory, UserPreferences } from '@/types';
import { Result } from '@/lib/types';

export interface ClassificationContext {
  readonly userPreferences: UserPreferences;
  readonly recentClassifications?: readonly EmailClassification[];
  readonly userFeedback?: readonly ClassificationFeedback[];
}

export interface ClassificationFeedback {
  readonly emailId: string;
  readonly originalClassification: EmailClassification;
  readonly userCorrection: Partial<EmailClassification>;
  readonly timestamp: Date;
}

export interface EmailClassificationRequest {
  readonly email: Email;
  readonly context: ClassificationContext;
}

export interface DetailedClassificationResult extends EmailClassification {
  readonly suggestions: readonly string[];
  readonly confidence_breakdown: {
    readonly urgency_confidence: number;
    readonly importance_confidence: number;
    readonly category_confidence: number;
    readonly action_confidence: number;
  };
  readonly processing_time_ms: number;
  readonly tokens_used: number;
}

export class EmailClassifier {
  private readonly claude: ClaudeClient;

  constructor(claude?: ClaudeClient) {
    this.claude = claude ?? createClaudeClient();
  }

  /**
   * Generate AI summary for priority dashboard
   */
  async generateSummary(params: {
    subject: string;
    snippet: string;
    classification: EmailClassification;
  }): Promise<Result<string, ClaudeIntegrationError>> {
    const { subject, snippet, classification } = params;
    
    const summaryPrompt = `
Summarize this email in exactly one sentence (maximum two sentences if absolutely necessary) for a priority dashboard. Focus on what action is needed or what the user should know.

Email Subject: "${subject}"
Email Snippet: "${snippet}"
AI Classification: ${classification.category} (urgency: ${classification.urgency}/5, importance: ${classification.importance}/5)
Action Required: ${classification.actionRequired}

Rules:
- Maximum 1 sentence (2 only if critical information would be lost)
- Focus on actionable information or key insights
- Use clear, professional language
- Include urgency indicators if priority is 4+ ("urgent", "deadline", etc.)
- Mention sender/context only if relevant to action

Examples:
- "Project deliverables require review and approval by end of day"
- "Team sync meeting starts in 30 minutes"
- "Investment portfolio recommendations available for review"
- "Bank statement ready for download"
`;

    const result = await this.claude.analyze(summaryPrompt);
    
    if (!result.success) {
      return result;
    }

    // Clean and format the summary
    let summary = result.data.content.trim();
    
    // Remove quotes if the AI added them
    summary = summary.replace(/^["']|["']$/g, '');
    
    // Ensure it ends with a period
    if (!summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
      summary += '.';
    }

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Classify a single email using Claude
   */
  async classifyEmail(
    request: EmailClassificationRequest
  ): Promise<Result<DetailedClassificationResult, ClaudeIntegrationError>> {
    const { email, context } = request;

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(email);

    const result = await this.claude.analyzeWithSchema(
      userPrompt,
      systemPrompt,
      (content: string) => this.parseClassificationResponse(content)
    );

    if (!result.success) {
      return result;
    }

    const classification = result.data;
    
    return {
      success: true,
      data: {
        ...classification,
        processing_time_ms: classification.metadata.processingTimeMs,
        tokens_used: classification.metadata.usage.inputTokens + classification.metadata.usage.outputTokens,
      },
    };
  }

  /**
   * Classify multiple emails in batch
   */
  async classifyEmailsBatch(
    requests: readonly EmailClassificationRequest[]
  ): Promise<readonly Result<DetailedClassificationResult, ClaudeIntegrationError>[]> {
    const results: Result<DetailedClassificationResult, ClaudeIntegrationError>[] = [];
    
    // Process in batches with rate limiting
    const concurrency = 2;
    const delayMs = 500;
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(request => this.classifyEmail(request));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Add delay between batches (except for the last batch)
      if (i + concurrency < requests.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }

  /**
   * Build the system prompt for Claude
   */
  private buildSystemPrompt(context: ClassificationContext): string {
    const { userPreferences, recentClassifications, userFeedback } = context;

    let prompt = `You are an AI email classification assistant for neurodivergent professionals. Your job is to analyze emails and provide structured classification to help with email management and prioritization.

CLASSIFICATION CRITERIA:

1. URGENCY (1-5 scale):
   - 1: No time pressure, can wait weeks
   - 2: Low urgency, can wait days
   - 3: Moderate urgency, should respond within 1-2 days
   - 4: High urgency, needs response within hours
   - 5: Critical urgency, immediate attention required

2. IMPORTANCE (1-5 scale):
   - 1: Trivial, can be ignored
   - 2: Low importance, nice to know
   - 3: Moderate importance, relevant to daily work
   - 4: High importance, significant impact on goals
   - 5: Critical importance, major consequences if ignored

3. CATEGORY:
   - work: Professional emails, meetings, projects
   - personal: Family, friends, personal matters
   - financial: Banking, investments, bills, taxes
   - opportunity: Job offers, networking, business opportunities
   - newsletter: Subscriptions, marketing, announcements
   - spam: Unwanted promotional emails, scams
   - other: Anything that doesn't fit above categories

4. ACTION REQUIRED:
   - true: Email requires a response or action from the user
   - false: Email is informational only

USER PREFERENCES:
- Priority Categories: ${userPreferences.priorityCategories.join(', ')}
- Working Hours: ${userPreferences.workingHours.start} - ${userPreferences.workingHours.end}
- Working Days: ${userPreferences.workingHours.days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
- Auto-unsubscribe enabled: ${userPreferences.autoUnsubscribeEnabled}`;

    // Add context from recent classifications for consistency
    if (recentClassifications && recentClassifications.length > 0) {
      prompt += `\n\nRECENT CLASSIFICATIONS (for consistency):
${recentClassifications.slice(0, 5).map(c => 
  `- Category: ${c.category}, Urgency: ${c.urgency}, Importance: ${c.importance}, Action: ${c.actionRequired}`
).join('\n')}`;
    }

    // Add user feedback for learning
    if (userFeedback && userFeedback.length > 0) {
      prompt += `\n\nUSER FEEDBACK (learn from corrections):
${userFeedback.slice(0, 3).map(f => 
  `- Original: ${f.originalClassification.category} (${f.originalClassification.urgency}/${f.originalClassification.importance})
  - Corrected: ${JSON.stringify(f.userCorrection)}`
).join('\n')}`;
    }

    prompt += `\n\nRESPONSE FORMAT:
Respond with a JSON object containing:
{
  "urgency": <1-5>,
  "importance": <1-5>,
  "actionRequired": <boolean>,
  "category": "<category>",
  "confidence": <0-1 decimal>,
  "reasoning": "<brief explanation>",
  "suggestions": ["<actionable suggestion>", "<another suggestion>"],
  "confidence_breakdown": {
    "urgency_confidence": <0-1>,
    "importance_confidence": <0-1>,
    "category_confidence": <0-1>,
    "action_confidence": <0-1>
  }
}

Be concise but accurate. Consider the user's work context and preferences.`;

    return prompt;
  }

  /**
   * Build the user prompt with email content
   */
  private buildUserPrompt(email: Email): string {
    const senderInfo = email.sender.name 
      ? `${email.sender.name} (${email.sender.email})`
      : email.sender.email;

    const recipientInfo = email.recipients
      .slice(0, 3)
      .map(r => r.name ? `${r.name} (${r.email})` : r.email)
      .join(', ');

    let prompt = `ANALYZE THIS EMAIL:

FROM: ${senderInfo}
TO: ${recipientInfo}${email.recipients.length > 3 ? ` (and ${email.recipients.length - 3} others)` : ''}
DATE: ${email.date.toISOString()}
SUBJECT: ${email.subject ?? '(no subject)'}

CONTENT:
${email.snippet}`;

    // Add body text if available and different from snippet
    if (email.bodyText && email.bodyText !== email.snippet && email.bodyText.length > email.snippet.length) {
      prompt += `\n\nFULL TEXT:
${email.bodyText.slice(0, 2000)}${email.bodyText.length > 2000 ? '...' : ''}`;
    }

    // Add Gmail labels as context
    if (email.labels.length > 0) {
      const relevantLabels = email.labels
        .filter(label => !label.startsWith('Label_') && label !== 'UNREAD')
        .join(', ');
      if (relevantLabels) {
        prompt += `\n\nGMAIL LABELS: ${relevantLabels}`;
      }
    }

    // Add read/important status
    prompt += `\n\nSTATUS: ${email.isRead ? 'Read' : 'Unread'}${email.isImportant ? ', Important' : ''}`;

    return prompt;
  }

  /**
   * Parse Claude's response into structured classification
   */
  private parseClassificationResponse(content: string): Omit<DetailedClassificationResult, 'processing_time_ms' | 'tokens_used'> {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      // Validate required fields
      const urgency = this.validateNumber(parsed['urgency'], 1, 5) as 1 | 2 | 3 | 4 | 5;
      const importance = this.validateNumber(parsed['importance'], 1, 5) as 1 | 2 | 3 | 4 | 5;
      const actionRequired = this.validateBoolean(parsed['actionRequired']);
      const category = this.validateCategory(parsed['category']);
      const confidence = this.validateNumber(parsed['confidence'], 0, 1);
      const reasoning = this.validateString(parsed['reasoning']);

      // Parse suggestions
      const suggestions = Array.isArray(parsed['suggestions']) 
        ? (parsed['suggestions'] as unknown[]).filter(s => typeof s === 'string') as readonly string[]
        : [];

      // Parse confidence breakdown
      const confidenceBreakdown = parsed['confidence_breakdown'] as Record<string, unknown> ?? {};
      const confidence_breakdown = {
        urgency_confidence: this.validateNumber(confidenceBreakdown['urgency_confidence'], 0, 1) ?? confidence,
        importance_confidence: this.validateNumber(confidenceBreakdown['importance_confidence'], 0, 1) ?? confidence,
        category_confidence: this.validateNumber(confidenceBreakdown['category_confidence'], 0, 1) ?? confidence,
        action_confidence: this.validateNumber(confidenceBreakdown['action_confidence'], 0, 1) ?? confidence,
      };

      return {
        urgency,
        importance,
        actionRequired,
        category,
        confidence,
        reasoning,
        suggestions,
        confidence_breakdown,
      };

    } catch (error) {
      throw new Error(`Failed to parse classification response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateNumber(value: unknown, min?: number, max?: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Expected number, got ${typeof value}`);
    }
    if (min !== undefined && value < min) {
      throw new Error(`Value ${value} below minimum ${min}`);
    }
    if (max !== undefined && value > max) {
      throw new Error(`Value ${value} above maximum ${max}`);
    }
    return value;
  }

  private validateBoolean(value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new Error(`Expected boolean, got ${typeof value}`);
    }
    return value;
  }

  private validateString(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error(`Expected string, got ${typeof value}`);
    }
    return value;
  }

  private validateCategory(value: unknown): EmailCategory {
    const validCategories: readonly EmailCategory[] = [
      'work', 'personal', 'financial', 'opportunity', 'newsletter', 'spam', 'other'
    ] as const;

    if (typeof value !== 'string' || !validCategories.includes(value as EmailCategory)) {
      throw new Error(`Invalid category: ${value}. Must be one of: ${validCategories.join(', ')}`);
    }

    return value as EmailCategory;
  }
}

/**
 * Factory function to create email classifier
 */
export function createEmailClassifier(): EmailClassifier {
  return new EmailClassifier();
}