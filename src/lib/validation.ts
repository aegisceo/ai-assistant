// Comprehensive validation schemas using Zod with strict TypeScript typing
import { z } from 'zod';
import type { Result } from './types';

// Base schemas for common patterns
export const emailStringSchema = z.string().email('Invalid email format');
export const urlSchema = z.string().url('Invalid URL format');
export const dateSchema = z.date();
export const positiveIntegerSchema = z.number().int().positive();

// Email address validation
export const emailAddressSchema = z.object({
    email: emailStringSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional()
});

// Email classification validation
export const emailCategorySchema = z.enum([
    'work',
    'personal',
    'financial',
    'opportunity',
    'newsletter',
    'spam',
    'other'
]);

export const emailClassificationSchema = z.object({
    urgency: z.number().int().min(1).max(5),
    importance: z.number().int().min(1).max(5),
    actionRequired: z.boolean(),
    category: emailCategorySchema,
    confidence: z.number().min(0).max(1),
    reasoning: z.string().max(500).optional()
});

// Working hours validation
export const workingHoursSchema = z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    days: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day must be selected')
}).refine(
    (data) => {
        const startParts = data.start.split(':');
        const endParts = data.end.split(':');

        const startHour = startParts[0];
        const startMinute = startParts[1];
        const endHour = endParts[0];
        const endMinute = endParts[1];

        if (!startHour || !startMinute || !endHour || !endMinute) {
            return false;
        }

        const startTime = parseInt(startHour) * 60 + parseInt(startMinute);
        const endTime = parseInt(endHour) * 60 + parseInt(endMinute);

        return startTime < endTime;
    },
    {
        message: 'Start time must be before end time',
        path: ['end']
    }
);

// Notification settings validation
export const notificationSettingsSchema = z.object({
    urgentEmails: z.boolean(),
    upcomingEvents: z.boolean(),
    missedOpportunities: z.boolean()
});

// User preferences validation
export const userPreferencesSchema = z.object({
    emailClassificationEnabled: z.boolean(),
    autoUnsubscribeEnabled: z.boolean(),
    priorityCategories: z.array(emailCategorySchema).min(1, 'At least one priority category must be selected'),
    workingHours: workingHoursSchema,
    notificationSettings: notificationSettingsSchema
});

// Calendar event validation
export const eventAttendeeSchema = z.object({
    email: emailStringSchema,
    name: z.string().max(100).optional(),
    responseStatus: z.enum(['accepted', 'declined', 'needsAction', 'tentative'])
});

export const calendarEventSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    start: dateSchema,
    end: dateSchema,
    description: z.string().max(1000).optional(),
    location: z.string().max(200).optional(),
    attendees: z.array(eventAttendeeSchema).default([]),
    isAllDay: z.boolean(),
    status: z.enum(['confirmed', 'tentative', 'cancelled'])
}).refine(
    (data) => data.start < data.end,
    {
        message: 'Start time must be before end time',
        path: ['end']
    }
);

// Email validation
export const emailSchema = z.object({
    id: z.string().min(1),
    threadId: z.string().min(1),
    subject: z.string().max(500).nullable(),
    sender: emailAddressSchema,
    recipients: z.array(emailAddressSchema).min(1, 'At least one recipient is required'),
    date: dateSchema,
    snippet: z.string().max(1000),
    bodyText: z.string().max(10000).nullable(),
    bodyHtml: z.string().max(50000).nullable(),
    isRead: z.boolean(),
    isImportant: z.boolean(),
    labels: z.array(z.string()).default([])
});

// API request validation
export const openAIClassificationRequestSchema = z.object({
    emailContent: z.string().min(1, 'Email content is required').max(50000),
    userContext: z.string().max(5000),
    priorityCategories: z.array(emailCategorySchema).min(1),
    previousClassifications: z.array(emailClassificationSchema).optional()
});

// Environment variables validation
export const environmentSchema = z.object({
    // OpenAI
    OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
    OPENAI_ORGANIZATION: z.string().optional(),

    // Google
    GOOGLE_CLIENT_ID: z.string().min(1, 'Google client ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google client secret is required'),
    GOOGLE_REDIRECT_URI: z.string().url('Invalid Google redirect URI'),

    // Supabase
    SUPABASE_URL: z.string().url('Invalid Supabase URL'),
    SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

    // Public environment variables
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid public Supabase URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Public Supabase anon key is required'),

    // App configuration
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),

    // Security
    JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
    ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('100')
});

// Database validation schemas
export const databaseEmailSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    gmail_id: z.string().min(1),
    subject: z.string().max(500).nullable(),
    sender_email: emailStringSchema,
    sender_name: z.string().max(100).nullable(),
    received_at: z.string().datetime(),
    classification: emailClassificationSchema.nullable(),
    processed_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});

export const databaseUserPreferencesSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    emailClassificationEnabled: z.boolean(),
    autoUnsubscribeEnabled: z.boolean(),
    priorityCategories: z.array(emailCategorySchema),
    workingHours: workingHoursSchema,
    notificationSettings: notificationSettingsSchema,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});

// Form validation schemas
export const loginFormSchema = z.object({
    email: emailStringSchema,
    password: z.string().min(8, 'Password must be at least 8 characters')
});

export const registrationFormSchema = z.object({
    email: emailStringSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions')
}).refine(
    (data) => data.password === data.confirmPassword,
    {
        message: 'Passwords do not match',
        path: ['confirmPassword']
    }
);

export const userProfileUpdateSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    timezone: z.string().min(1, 'Timezone is required'),
    workingHours: workingHoursSchema,
    notificationSettings: notificationSettingsSchema
});

// Search and filter validation
export const emailSearchSchema = z.object({
    query: z.string().max(100, 'Search query too long'),
    category: emailCategorySchema.optional(),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    isRead: z.boolean().optional(),
    isImportant: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

// Export types for use in the application
export type ValidatedEmail = z.infer<typeof emailSchema>;
export type ValidatedEmailClassification = z.infer<typeof emailClassificationSchema>;
export type ValidatedUserPreferences = z.infer<typeof userPreferencesSchema>;
export type ValidatedCalendarEvent = z.infer<typeof calendarEventSchema>;
export type ValidatedEnvironment = z.infer<typeof environmentSchema>;
export type ValidatedLoginForm = z.infer<typeof loginFormSchema>;
export type ValidatedRegistrationForm = z.infer<typeof registrationFormSchema>;
export type ValidatedUserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
export type ValidatedEmailSearch = z.infer<typeof emailSearchSchema>;

// Validation utility functions
export const validateEmail = (data: unknown): Result<ValidatedEmail, z.ZodError> => {
    const result = emailSchema.safeParse(data);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
};

export const validateUserPreferences = (data: unknown): Result<ValidatedUserPreferences, z.ZodError> => {
    const result = userPreferencesSchema.safeParse(data);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
};

export const validateEnvironment = (): Result<ValidatedEnvironment, z.ZodError> => {
    const result = environmentSchema.safeParse(process.env);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
};

// Type-safe validation with error handling
export const createValidatedObject = <T>(
    schema: z.ZodSchema<T>,
    data: unknown
): Result<T, z.ZodError> => {
    const result = schema.safeParse(data);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
};
