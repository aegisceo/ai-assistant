/**
 * Anthropic Claude API Client
 * Provides type-safe integration with Claude for email analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { Result } from '@/lib/types';

export interface ClaudeConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

export class ClaudeIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ClaudeIntegrationError';
  }
}

export interface ClaudeAnalysisResult {
  readonly content: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly processingTimeMs: number;
}

export class ClaudeClient {
  private readonly client: Anthropic;
  private readonly config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
      ...config,
    };
    
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Analyze content with Claude
   */
  async analyze(
    prompt: string,
    systemPrompt?: string
  ): Promise<Result<ClaudeAnalysisResult, ClaudeIntegrationError>> {
    const startTime = Date.now();

    try {
      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: prompt,
        },
      ];

      const response = await this.client.messages.create({
        model: this.config.model ?? 'claude-3-sonnet-20240229',
        max_tokens: this.config.maxTokens ?? 4000,
        messages,
        ...(systemPrompt !== null && systemPrompt !== undefined ? { system: systemPrompt } : {}),
      });

      const processingTimeMs = Date.now() - startTime;

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      if (!textContent) {
        return {
          success: false,
          error: new ClaudeIntegrationError(
            'No text content in Claude response',
            'NO_CONTENT',
            response
          ),
        };
      }

      return {
        success: true,
        data: {
          content: textContent,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          processingTimeMs,
        },
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      // Handle Anthropic API errors
      if (error instanceof Anthropic.APIError) {
        return {
          success: false,
          error: new ClaudeIntegrationError(
            `Claude API Error: ${error.message}`,
            'API_ERROR',
            { status: error.status, processingTimeMs }
          ),
        };
      }

      // Handle network/other errors
      return {
        success: false,
        error: new ClaudeIntegrationError(
          `Claude integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INTEGRATION_ERROR',
          { error, processingTimeMs }
        ),
      };
    }
  }

  /**
   * Analyze with structured output parsing
   */
  async analyzeWithSchema<T>(
    prompt: string,
    systemPrompt: string,
    parseResponse: (content: string) => T
  ): Promise<Result<T & { metadata: ClaudeAnalysisResult }, ClaudeIntegrationError>> {
    const analysisResult = await this.analyze(prompt, systemPrompt);

    if (!analysisResult.success) {
      return analysisResult;
    }

    try {
      const parsed = parseResponse(analysisResult.data.content);
      return {
        success: true,
        data: {
          ...parsed,
          metadata: analysisResult.data,
        },
      };
    } catch (parseError) {
      return {
        success: false,
        error: new ClaudeIntegrationError(
          'Failed to parse Claude response',
          'PARSE_ERROR',
          { parseError, rawContent: analysisResult.data.content }
        ),
      };
    }
  }

  /**
   * Batch analysis with rate limiting
   */
  async analyzeBatch<T>(
    items: readonly T[],
    analyzer: (item: T) => Promise<Result<ClaudeAnalysisResult, ClaudeIntegrationError>>,
    options: {
      readonly concurrency?: number;
      readonly delayMs?: number;
    } = {}
  ): Promise<readonly Result<ClaudeAnalysisResult, ClaudeIntegrationError>[]> {
    const { concurrency = 3, delayMs = 1000 } = options;
    const results: Result<ClaudeAnalysisResult, ClaudeIntegrationError>[] = [];

    // Process in batches to respect rate limits
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchPromises = batch.map(analyzer);
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);

      // Add delay between batches (except for last batch)
      if (i + concurrency < items.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

/**
 * Factory function to create Claude client with environment variables
 */
export function createClaudeClient(): ClaudeClient {
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (apiKey === null || apiKey === undefined || apiKey === '') {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }

  return new ClaudeClient({
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 1024,
  });
}