/**
 * Secure Logging Utility
 *
 * Prevents accidental logging of sensitive data (passwords, tokens, secrets, keys, PII)
 * Use this instead of console.log/error when dealing with potentially sensitive data
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface SafeLogOptions {
  level?: LogLevel;
  redactFields?: string[];
  showPrefix?: boolean;
  prefixLength?: number;
}

/**
 * Default sensitive field names to automatically redact
 */
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'key',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'credential',
  'credentials',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
  'ssn',
  'social_security',
  'creditcard',
  'credit_card',
  'cvv',
  'pin',
  'authorization',
];

/**
 * Email-related sensitive fields
 */
const EMAIL_SENSITIVE_FIELDS = [
  'body',
  'content',
  'html',
  'text',
  'snippet',
  'payload',
];

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveField(key: string, sensitiveFields: string[]): boolean {
  const lowerKey = key.toLowerCase();
  return sensitiveFields.some(field => lowerKey.includes(field));
}

/**
 * Redact sensitive data from an object
 */
function redactSensitiveData(
  data: any,
  sensitiveFields: string[] = DEFAULT_SENSITIVE_FIELDS
): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, sensitiveFields));
  }

  // Handle objects
  const safe: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key, sensitiveFields)) {
      // Redact sensitive fields
      if (typeof value === 'string') {
        safe[key] = `[REDACTED - Length: ${value.length}]`;
      } else {
        safe[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      safe[key] = redactSensitiveData(value, sensitiveFields);
    } else {
      // Keep non-sensitive fields as-is
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Safely log a value with automatic sensitive field redaction
 */
export function safeLog(
  label: string,
  value: any,
  options: SafeLogOptions = {}
): void {
  const {
    level = LogLevel.INFO,
    redactFields = DEFAULT_SENSITIVE_FIELDS,
    showPrefix = false,
    prefixLength = 4
  } = options;

  const logFn = console[level] || console.log;

  if (value === null || value === undefined) {
    logFn(`${label}: ${value}`);
    return;
  }

  // Handle strings that might be sensitive
  if (typeof value === 'string') {
    if (isSensitiveField(label, redactFields)) {
      if (showPrefix && value.length > prefixLength) {
        logFn(`${label}: ${value.substring(0, prefixLength)}... [${value.length} chars]`);
      } else {
        logFn(`${label}: [REDACTED - Length: ${value.length}]`);
      }
    } else {
      logFn(`${label}: ${value}`);
    }
    return;
  }

  // Handle objects
  if (typeof value === 'object') {
    const safeValue = redactSensitiveData(value, redactFields);
    logFn(`${label}:`, safeValue);
    return;
  }

  // Handle primitives
  logFn(`${label}:`, value);
}

/**
 * Safely log email data (redacts body/content)
 */
export function safeLogEmail(label: string, email: any): void {
  const emailSensitiveFields = [...DEFAULT_SENSITIVE_FIELDS, ...EMAIL_SENSITIVE_FIELDS];

  safeLog(label, email, {
    redactFields: emailSensitiveFields,
    level: LogLevel.INFO
  });
}

/**
 * Safely log token/secret with optional prefix display
 */
export function safeLogToken(
  label: string,
  token: string | undefined | null,
  showPrefix: boolean = false
): void {
  if (!token) {
    console.log(`${label}: [NOT PROVIDED]`);
    return;
  }

  if (showPrefix) {
    console.log(`${label}: ${token.substring(0, 8)}... [${token.length} chars]`);
  } else {
    console.log(`${label}: [REDACTED - Length: ${token.length}]`);
  }
}

/**
 * Safely log API response (redacts sensitive headers/fields)
 */
export function safeLogResponse(label: string, response: any): void {
  const safe = {
    ...response,
    headers: response.headers ? redactSensitiveData(response.headers) : undefined,
    data: response.data ? redactSensitiveData(response.data) : undefined,
    body: response.body ? '[REDACTED]' : undefined
  };

  console.log(label, safe);
}

/**
 * Logger class with contextual logging
 */
export class SecureLogger {
  private context: string;
  private defaultLevel: LogLevel;

  constructor(context: string, defaultLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.defaultLevel = defaultLevel;
  }

  /**
   * Log with automatic sensitive data redaction
   */
  log(message: string, data?: any, level?: LogLevel): void {
    const logLevel = level || this.defaultLevel;
    const logFn = console[logLevel] || console.log;

    if (data !== undefined) {
      const safeData = redactSensitiveData(data);
      logFn(`[${this.context}] ${message}`, safeData);
    } else {
      logFn(`[${this.context}] ${message}`);
    }
  }

  debug(message: string, data?: any): void {
    this.log(message, data, LogLevel.DEBUG);
  }

  info(message: string, data?: any): void {
    this.log(message, data, LogLevel.INFO);
  }

  warn(message: string, data?: any): void {
    this.log(message, data, LogLevel.WARN);
  }

  error(message: string, data?: any): void {
    this.log(message, data, LogLevel.ERROR);
  }

  /**
   * Log email safely
   */
  logEmail(message: string, email: any): void {
    const emailSensitive = [...DEFAULT_SENSITIVE_FIELDS, ...EMAIL_SENSITIVE_FIELDS];
    const safeEmail = redactSensitiveData(email, emailSensitive);
    this.info(message, safeEmail);
  }

  /**
   * Log token/secret safely
   */
  logToken(label: string, token: string | undefined | null, showPrefix: boolean = false): void {
    if (!token) {
      this.info(`${label}: [NOT PROVIDED]`);
      return;
    }

    if (showPrefix) {
      this.info(`${label}: ${token.substring(0, 8)}... [${token.length} chars]`);
    } else {
      this.info(`${label}: [REDACTED - Length: ${token.length}]`);
    }
  }
}

/**
 * Create a contextual logger
 */
export function createLogger(context: string, level?: LogLevel): SecureLogger {
  return new SecureLogger(context, level);
}

/**
 * Example usage:
 *
 * import { safeLog, safeLogEmail, safeLogToken, createLogger } from './secure-logger';
 *
 * // Simple usage
 * safeLog('User data', user);  // Automatically redacts password, token, etc.
 * safeLogEmail('Incoming email', email);  // Redacts body/content
 * safeLogToken('API Token', apiToken);  // Shows only [REDACTED - Length: 128]
 *
 * // Contextual logger
 * const logger = createLogger('EmailService');
 * logger.info('Processing email', { emailId: '123' });  // [EmailService] Processing email
 * logger.logEmail('Received', email);  // Auto-redacts sensitive fields
 * logger.logToken('Auth token', token);  // Safe token logging
 */
