// Comprehensive error types for the AI Assistant
import type { CalendarId, EmailId, UserId } from '@/lib/types';

// Base error class for the application
export abstract class AIAssistantError extends Error {
    abstract readonly code: string;
    abstract readonly statusCode: number;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = this.constructor.name;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Set cause property manually to avoid override issues
        Object.defineProperty(this, 'cause', {
            value: cause,
            writable: false,
            enumerable: false,
            configurable: true
        });
    }
}

// Email-related errors
export class EmailProcessingError extends AIAssistantError {
    readonly code = 'EMAIL_PROCESSING_ERROR';
    readonly statusCode = 500;

    constructor(
        message: string,
        public readonly emailId: EmailId,
        public readonly operation: 'fetch' | 'classify' | 'store' | 'update',
        cause?: unknown
    ) {
        super(message, cause);
    }
}

export class EmailNotFoundError extends AIAssistantError {
    readonly code = 'EMAIL_NOT_FOUND';
    readonly statusCode = 404;

    constructor(
        public readonly emailId: EmailId,
        public readonly userId: UserId
    ) {
        super(`Email ${emailId} not found for user ${userId}`);
    }
}

// AI Classification errors
export class ClassificationError extends AIAssistantError {
    readonly code = 'CLASSIFICATION_ERROR';
    readonly statusCode = 500;

    constructor(
        message: string,
        public readonly emailId: EmailId,
        public readonly provider: 'openai' | 'anthropic' | 'local',
        cause?: unknown
    ) {
        super(message, cause);
    }
}

export class ClassificationTimeoutError extends AIAssistantError {
    readonly code = 'CLASSIFICATION_TIMEOUT';
    readonly statusCode = 408;

    constructor(
        public readonly emailId: EmailId,
        public readonly timeoutMs: number
    ) {
        super(`Classification timed out after ${timeoutMs}ms for email ${emailId}`);
    }
}

// Authentication and authorization errors
export class AuthenticationError extends AIAssistantError {
    readonly code = 'AUTHENTICATION_ERROR';
    readonly statusCode = 401;

    constructor(
        message: string,
        public readonly provider: 'google' | 'supabase' | 'openai',
        cause?: unknown
    ) {
        super(message, cause);
    }
}

export class AuthorizationError extends AIAssistantError {
    readonly code = 'AUTHORIZATION_ERROR';
    readonly statusCode = 403;

    constructor(
        message: string,
        public readonly userId: UserId,
        public readonly resource: string,
        public readonly action: string
    ) {
        super(message);
    }
}

// Rate limiting errors
export class RateLimitError extends AIAssistantError {
    readonly code = 'RATE_LIMIT_EXCEEDED';
    readonly statusCode = 429;

    constructor(
        message: string,
        public readonly provider: 'openai' | 'gmail' | 'supabase',
        public readonly retryAfter: number,
        public readonly limit: string
    ) {
        super(message);
    }
}

// Database errors
export class DatabaseError extends AIAssistantError {
    readonly code = 'DATABASE_ERROR';
    readonly statusCode = 500;

    constructor(
        message: string,
        public readonly operation: 'insert' | 'update' | 'delete' | 'select',
        public readonly table: string,
        cause?: unknown
    ) {
        super(message, cause);
    }
}

// Validation errors
export class ValidationError extends AIAssistantError {
    readonly code = 'VALIDATION_ERROR';
    readonly statusCode = 400;

    constructor(
        message: string,
        public readonly field: string,
        public readonly value: unknown,
        public readonly constraint: string
    ) {
        super(message);
    }
}

// Calendar-related errors
export class CalendarError extends AIAssistantError {
    readonly code = 'CALENDAR_ERROR';
    readonly statusCode = 500;

    constructor(
        message: string,
        public readonly calendarId: CalendarId,
        public readonly operation: 'fetch' | 'create' | 'update' | 'delete',
        cause?: unknown
    ) {
        super(message, cause);
    }
}

// Network and external service errors
export class ExternalServiceError extends AIAssistantError {
    readonly code = 'EXTERNAL_SERVICE_ERROR';
    readonly statusCode = 502;

    constructor(
        message: string,
        public readonly service: string,
        public readonly endpoint: string,
        public readonly httpStatus: number,
        cause?: unknown
    ) {
        super(message, cause);
    }
}

// Error type union for comprehensive error handling
export type AIAssistantErrorType =
    | EmailProcessingError
    | EmailNotFoundError
    | ClassificationError
    | ClassificationTimeoutError
    | AuthenticationError
    | AuthorizationError
    | RateLimitError
    | DatabaseError
    | ValidationError
    | CalendarError
    | ExternalServiceError;

// Error mapping utility
export const mapErrorToStatusCode = (error: AIAssistantErrorType): number => {
    return error.statusCode;
};

// Error logging utility (privacy-safe)
export const logError = (error: AIAssistantErrorType): void => {
    // In production, log to monitoring service
    // In development, log to console with sensitive data redacted
    if (process.env.NODE_ENV === 'development') {
        const logData: Record<string, unknown> = {
            name: error.name,
            stack: error.stack
        };

        // Don't log sensitive data like email content or user IDs in development
        const errorCause = (error as { cause?: unknown }).cause;
        if (errorCause) {
            logData['cause'] = errorCause;
        }

        console.error(`[${error.code}] ${error.message}`, logData);
    }
};
