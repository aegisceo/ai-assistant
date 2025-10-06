/**
 * Custom hook for creating authenticated API client
 * Uses Supabase auth context to provide real tokens
 */

import { useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ApiClient } from './api-client';

export function useApiClient(): ApiClient {
  const { session } = useAuth();

  return useMemo(() => {
    const getAuthToken = (): string | null => {
      return session?.access_token ?? null;
    };

    return new ApiClient('', getAuthToken);
  }, [session]);
}