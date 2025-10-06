import { createClient } from '@supabase/supabase-js';
import { Result } from '@/lib/types';
import { GmailTokens, GmailIntegrationError } from './client';

export interface StoredGmailTokens extends GmailTokens {
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GmailAuthService {
  storeTokens(userId: string, tokens: GmailTokens): Promise<Result<void, GmailIntegrationError>>;
  getTokens(userId: string): Promise<Result<GmailTokens | null, GmailIntegrationError>>;
  updateTokens(userId: string, tokens: Partial<GmailTokens>): Promise<Result<void, GmailIntegrationError>>;
  deleteTokens(userId: string): Promise<Result<void, GmailIntegrationError>>;
  isTokenExpired(tokens: GmailTokens): boolean;
}

export class SupabaseGmailAuthService implements GmailAuthService {
  private readonly supabase;

  constructor(
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Store Gmail tokens for a user
   */
  async storeTokens(
    userId: string, 
    tokens: GmailTokens
  ): Promise<Result<void, GmailIntegrationError>> {
    try {
      const { error } = await this.supabase
        .from('gmail_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          scope: tokens.scope,
          token_type: tokens.tokenType,
          expiry_date: new Date(tokens.expiryDate).toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        return {
          success: false,
          error: new GmailIntegrationError(
            'Failed to store Gmail tokens',
            'STORE_TOKENS_FAILED',
            error
          ),
        };
      }

      return { success: true, data: void 0 };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Database error while storing tokens',
          'DATABASE_ERROR',
          error
        ),
      };
    }
  }

  /**
   * Retrieve Gmail tokens for a user
   */
  async getTokens(userId: string): Promise<Result<GmailTokens | null, GmailIntegrationError>> {
    try {
      const { data, error } = await this.supabase
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user has no tokens stored
          return { success: true, data: null };
        }
        
        return {
          success: false,
          error: new GmailIntegrationError(
            'Failed to retrieve Gmail tokens',
            'GET_TOKENS_FAILED',
            error
          ),
        };
      }

      if (!data) {
        return { success: true, data: null };
      }

      const tokens: GmailTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        tokenType: data.token_type,
        expiryDate: new Date(data.expiry_date).getTime(),
      };

      return { success: true, data: tokens };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Database error while retrieving tokens',
          'DATABASE_ERROR',
          error
        ),
      };
    }
  }

  /**
   * Update specific token fields for a user
   */
  async updateTokens(
    userId: string, 
    tokenUpdates: Partial<GmailTokens>
  ): Promise<Result<void, GmailIntegrationError>> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (tokenUpdates.accessToken !== undefined) {
        updateData['access_token'] = tokenUpdates.accessToken;
      }
      if (tokenUpdates.refreshToken !== undefined) {
        updateData['refresh_token'] = tokenUpdates.refreshToken;
      }
      if (tokenUpdates.scope !== undefined) {
        updateData['scope'] = tokenUpdates.scope;
      }
      if (tokenUpdates.tokenType !== undefined) {
        updateData['token_type'] = tokenUpdates.tokenType;
      }
      if (tokenUpdates.expiryDate !== undefined) {
        updateData['expiry_date'] = new Date(tokenUpdates.expiryDate).toISOString();
      }

      const { error } = await this.supabase
        .from('gmail_tokens')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: new GmailIntegrationError(
            'Failed to update Gmail tokens',
            'UPDATE_TOKENS_FAILED',
            error
          ),
        };
      }

      return { success: true, data: void 0 };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Database error while updating tokens',
          'DATABASE_ERROR',
          error
        ),
      };
    }
  }

  /**
   * Delete Gmail tokens for a user
   */
  async deleteTokens(userId: string): Promise<Result<void, GmailIntegrationError>> {
    try {
      const { error } = await this.supabase
        .from('gmail_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: new GmailIntegrationError(
            'Failed to delete Gmail tokens',
            'DELETE_TOKENS_FAILED',
            error
          ),
        };
      }

      return { success: true, data: void 0 };
    } catch (error) {
      return {
        success: false,
        error: new GmailIntegrationError(
          'Database error while deleting tokens',
          'DATABASE_ERROR',
          error
        ),
      };
    }
  }

  /**
   * Check if tokens are expired (with 5 minute buffer)
   */
  isTokenExpired(tokens: GmailTokens): boolean {
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return Date.now() >= (tokens.expiryDate - bufferMs);
  }
}

/**
 * Factory function to create auth service with environment variables
 */
export function createGmailAuthService(): SupabaseGmailAuthService {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']; // Use service role key for server operations

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  return new SupabaseGmailAuthService(supabaseUrl, supabaseKey);
}