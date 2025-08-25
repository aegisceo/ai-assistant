// Comprehensive utility functions with strict TypeScript typing
import type { Email, EmailClassification } from '@/types';
import {
  DatabaseError,
  RateLimitError,
  ValidationError
} from '@/types/errors';
import {
  HTTP_STATUS,
  TIME
} from './constants';
import type { Result } from './types';

// Type-safe string utilities
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const truncateString = (
  str: string,
  maxLength: number,
  suffix: string = '...'
): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};

export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .trim();
};

// Type-safe number utilities
export const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

export const clampNumber = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.min(Math.max(value, min), max);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Type-safe date utilities
export const isValidDate = (date: unknown): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
};

export const formatTime = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
};

export const isWithinWorkingHours = (
  date: Date,
  startTime: string,
  endTime: string
): boolean => {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime = hour * 60 + minute;

  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);

  const startHour = startParts[0];
  const startMinute = startParts[1];
  const endHour = endParts[0];
  const endMinute = endParts[1];

  if (startHour === undefined || startMinute === undefined ||
    endHour === undefined || endMinute === undefined) {
    return false;
  }

  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  return currentTime >= startTimeMinutes && currentTime <= endTimeMinutes;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysBetween = (startDate: Date, endDate: Date): number => {
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.ceil(timeDiff / TIME.MILLISECONDS.DAY);
};

// Type-safe array utilities
export const isNonEmptyArray = <T>(arr: unknown): arr is readonly T[] => {
  return Array.isArray(arr) && arr.length > 0;
};

export const chunkArray = <T>(
  array: readonly T[],
  chunkSize: number
): readonly T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

export const uniqueArray = <T>(array: readonly T[]): readonly T[] => {
  return Array.from(new Set(array));
};

export const sortByProperty = <T, K extends keyof T>(
  array: readonly T[],
  property: K,
  order: 'asc' | 'desc' = 'asc'
): readonly T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

// Type-safe object utilities
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const omit = <T, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
};

export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};

// Email-specific utilities
export const extractEmailDomain = (email: string): string => {
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.slice(atIndex + 1) : '';
};

export const isWorkEmail = (email: string): boolean => {
  const domain = extractEmailDomain(email);
  const workDomains = ['company.com', 'corp.com', 'business.com'];
  return workDomains.some(workDomain => domain.includes(workDomain));
};

export const calculateEmailPriority = (
  classification: EmailClassification
): number => {
  // Priority calculation based on urgency and importance
  const urgencyWeight = 0.6;
  const importanceWeight = 0.4;

  return (
    classification.urgency * urgencyWeight +
    classification.importance * importanceWeight
  );
};

export const shouldProcessEmail = (
  _email: Email,
  classification: EmailClassification
): boolean => {
  // Skip processing for low-priority emails
  if (classification.urgency > 4 && classification.importance > 4) {
    return false;
  }

  // Skip spam emails
  if (classification.category === 'spam') {
    return false;
  }

  // Skip newsletters if user prefers
  if (classification.category === 'newsletter' && !classification.actionRequired) {
    return false;
  }

  return true;
};

// Validation utilities
export const validateEmailAddress = (email: string): Result<string, ValidationError> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: new ValidationError(
        'Invalid email format',
        'email',
        email,
        'Must be a valid email address'
      )
    };
  }

  if (email.length > 254) {
    return {
      success: false,
      error: new ValidationError(
        'Email too long',
        'email',
        email,
        'Must be less than 254 characters'
      )
    };
  }

  return { success: true, data: email };
};

export const validateUrl = (url: string): Result<string, ValidationError> => {
  try {
    new URL(url);
    return { success: true, data: url };
  } catch {
    return {
      success: false,
      error: new ValidationError(
        'Invalid URL format',
        'url',
        url,
        'Must be a valid URL'
      )
    };
  }
};

// Error handling utilities
export const createErrorResponse = (
  error: Error,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
): { readonly error: string; readonly statusCode: number } => {
  return {
    error: error.message || 'An unexpected error occurred',
    statusCode
  };
};

export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof RateLimitError) return true;
  if (error instanceof DatabaseError) return true;

  // Check for network errors
  if (error instanceof Error) {
    const retryableMessages = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'unavailable'
    ];

    return retryableMessages.some(msg =>
      error.message.toLowerCase().includes(msg)
    );
  }

  return false;
};

export const calculateRetryDelay = (
  attempt: number,
  baseDelay: number = 1000
): number => {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
};

// Performance utilities
export const debounce = <T extends readonly unknown[]>(
  func: (...args: T) => void,
  delay: number
): ((...args: T) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const throttle = <T extends readonly unknown[]>(
  func: (...args: T) => void,
  limit: number
): ((...args: T) => void) => {
  let inThrottle: boolean;

  return (...args: T) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Security utilities
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

export const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Type guards for runtime type checking
export const isEmail = (obj: unknown): obj is Email => {
  return (
    isPlainObject(obj) &&
    typeof obj['id'] === 'string' &&
    typeof obj['threadId'] === 'string' &&
    (typeof obj['subject'] === 'string' || obj['subject'] === null) &&
    typeof obj['date'] === 'object' && obj['date'] instanceof Date
  );
};

export const isEmailClassification = (obj: unknown): obj is EmailClassification => {
  return (
    isPlainObject(obj) &&
    typeof obj['urgency'] === 'number' &&
    typeof obj['importance'] === 'number' &&
    typeof obj['actionRequired'] === 'boolean' &&
    typeof obj['category'] === 'string' &&
    typeof obj['confidence'] === 'number'
  );
};

// Export utility types
export type NonEmptyString = string & { readonly __brand: 'NonEmptyString' };
export type PositiveInteger = number & { readonly __brand: 'PositiveInteger' };
export type ValidDate = Date & { readonly __brand: 'ValidDate' };
export type NonEmptyArray<T> = readonly [T, ...T[]];
