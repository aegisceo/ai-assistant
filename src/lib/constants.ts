// Comprehensive constants for the AI Assistant with strict TypeScript typing

// Application constants
export const APP_CONFIG = {
  name: 'AI Assistant',
  version: '1.0.0',
  description: 'AI-powered digital assistant for neurodivergent professionals',
  maxEmailSize: 50 * 1024 * 1024, // 50MB
  maxAttachmentSize: 25 * 1024 * 1024, // 25MB
  defaultPageSize: 20,
  maxPageSize: 100,
  sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRetryAttempts: 3,
  defaultTimeoutMs: 30000, // 30 seconds
} as const;

// Email classification constants
export const EMAIL_CLASSIFICATION = {
  urgencyLevels: [1, 2, 3, 4, 5] as const,
  importanceLevels: [1, 2, 3, 4, 5] as const,
  confidenceThreshold: 0.7,
  maxReasoningLength: 500,
  defaultUrgency: 3,
  defaultImportance: 3,
  categories: [
    'work',
    'personal',
    'financial',
    'opportunity',
    'newsletter',
    'spam',
    'other'
  ] as const,
} as const;

// AI model constants
export const AI_MODELS = {
  openai: {
    gpt4: 'gpt-4',
    gpt35Turbo: 'gpt-3.5-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    maxRetries: 3,
    timeoutMs: 60000, // 60 seconds
  },
  anthropic: {
    claude3Opus: 'claude-3-opus-20240229',
    claude3Sonnet: 'claude-3-sonnet-20240229',
    claude3Haiku: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    temperature: 0.7,
    maxRetries: 3,
    timeoutMs: 60000, // 60 seconds
  },
} as const;

// Rate limiting constants
export const RATE_LIMITS = {
  emailClassification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many email classification requests',
  },
  apiRequests: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many API requests',
  },
  authentication: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    message: 'Too many authentication attempts',
  },
  emailProcessing: {
    windowMs: 60 * 1000, // 1 minute
    maxEmails: 50,
    message: 'Too many emails processed',
  },
} as const;

// Security constants
export const SECURITY = {
  passwordMinLength: 8,
  passwordMaxLength: 128,
  jwtExpiry: '24h',
  refreshTokenExpiry: '7d',
  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  sessionSecretMinLength: 32,
  encryptionKeyMinLength: 32,
  csrfTokenExpiry: '1h',
  maxConcurrentSessions: 5,
} as const;

// Database constants
export const DATABASE = {
  maxConnectionPool: 20,
  connectionTimeoutMs: 30000, // 30 seconds
  queryTimeoutMs: 60000, // 60 seconds
  maxRetries: 3,
  retryDelayMs: 1000, // 1 second
  batchSize: 100,
  maxTransactionRetries: 3,
} as const;

// Email processing constants
export const EMAIL_PROCESSING = {
  batchSize: 50,
  maxConcurrentBatches: 3,
  processingTimeoutMs: 300000, // 5 minutes
  retryDelayMs: 5000, // 5 seconds
  maxRetries: 3,
  priorityQueueSize: 1000,
  lowPriorityDelayMs: 60000, // 1 minute
  highPriorityDelayMs: 1000, // 1 second
} as const;

// Calendar integration constants
export const CALENDAR = {
  maxEventDuration: 24 * 60 * 60 * 1000, // 24 hours
  minEventDuration: 15 * 60 * 1000, // 15 minutes
  defaultEventDuration: 60 * 60 * 1000, // 1 hour
  maxAttendees: 100,
  maxRecurringEvents: 100,
  syncIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxCalendarSync: 10,
} as const;

// Notification constants
export const NOTIFICATIONS = {
  maxPushNotifications: 100,
  maxEmailNotifications: 50,
  maxSmsNotifications: 10,
  notificationExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  batchSize: 20,
  retryAttempts: 3,
  retryDelayMs: 5000, // 5 seconds
  maxConcurrentNotifications: 10,
} as const;

// File upload constants
export const FILE_UPLOADS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'text/plain',
    'text/html',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ] as const,
  maxFilesPerUpload: 10,
  uploadTimeoutMs: 300000, // 5 minutes
  chunkSize: 1024 * 1024, // 1MB
} as const;

// Search and filtering constants
export const SEARCH = {
  maxQueryLength: 100,
  maxFilters: 10,
  maxSortFields: 3,
  defaultSearchLimit: 20,
  maxSearchLimit: 100,
  searchTimeoutMs: 10000, // 10 seconds
  maxSearchHistory: 100,
  fuzzySearchThreshold: 0.8,
} as const;

// Caching constants
export const CACHE = {
  defaultTtl: 300, // 5 minutes
  maxTtl: 3600, // 1 hour
  minTtl: 60, // 1 minute
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxCacheKeys: 10000,
} as const;

// Logging constants
export const LOGGING = {
  maxLogSize: 10 * 1024 * 1024, // 10MB
  maxLogFiles: 5,
  logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  logFormat: 'json',
  maxLogEntries: 10000,
  logRetentionDays: 30,
} as const;

// Error constants
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT',
  
  // Email processing errors
  EMAIL_PROCESSING_ERROR: 'EMAIL_PROCESSING_ERROR',
  CLASSIFICATION_ERROR: 'CLASSIFICATION_ERROR',
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Time constants
export const TIME = {
  MILLISECONDS: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
    YEAR: 365 * 24 * 60 * 60 * 1000,
  },
  SECONDS: {
    MINUTE: 60,
    HOUR: 60 * 60,
    DAY: 24 * 60 * 60,
    WEEK: 7 * 24 * 60 * 60,
    MONTH: 30 * 24 * 60 * 60,
    YEAR: 365 * 24 * 60 * 60,
  },
  MINUTES: {
    HOUR: 60,
    DAY: 24 * 60,
    WEEK: 7 * 24 * 60,
    MONTH: 30 * 24 * 60,
    YEAR: 365 * 24 * 60,
  },
  HOURS: {
    DAY: 24,
    WEEK: 7 * 24,
    MONTH: 30 * 24,
    YEAR: 365 * 24,
  },
} as const;

// Export type for constants
export type AppConfig = typeof APP_CONFIG;
export type EmailClassificationConfig = typeof EMAIL_CLASSIFICATION;
export type AIModelConfig = typeof AI_MODELS;
export type RateLimitConfig = typeof RATE_LIMITS;
export type SecurityConfig = typeof SECURITY;
export type DatabaseConfig = typeof DATABASE;
export type EmailProcessingConfig = typeof EMAIL_PROCESSING;
export type CalendarConfig = typeof CALENDAR;
export type NotificationConfig = typeof NOTIFICATIONS;
export type FileUploadConfig = typeof FILE_UPLOADS;
export type SearchConfig = typeof SEARCH;
export type CacheConfig = typeof CACHE;
export type LoggingConfig = typeof LOGGING;
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type TimeConfig = typeof TIME;
