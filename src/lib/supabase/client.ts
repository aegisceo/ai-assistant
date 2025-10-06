/**
 * Supabase client configuration for browser environment
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/api';

export function createClient(): ReturnType<typeof createBrowserClient<Database>> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createBrowserClient<Database>(url, key);
}