// Result Pattern for Error Handling
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Brand Types for IDs
export type UserId = string & { readonly __brand: 'UserId' };
export type EmailId = string & { readonly __brand: 'EmailId' };
export type CalendarId = string & { readonly __brand: 'CalendarId' };

// Helper Functions
export const createUserId = (id: string): UserId => id as UserId;
export const createEmailId = (id: string): EmailId => id as EmailId;
export const createCalendarId = (id: string): CalendarId => id as CalendarId;

// Type Guards
export const isUserId = (id: string): id is UserId => id.length > 0;
export const isEmailId = (id: string): id is EmailId => id.length > 0;
export const isCalendarId = (id: string): id is CalendarId => id.length > 0;

// Non-Empty Array Type
export type NonEmptyArray<T> = readonly [T, ...T[]];

// Exact Type Helper
export type Exact<T, U> = T extends U ? (U extends T ? T : never) : never;

// Environment Variables with Validation
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
