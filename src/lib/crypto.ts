/**
 * Cryptographic utilities for secure token generation
 */

/**
 * Generates a cryptographically secure random state parameter for OAuth CSRF protection
 * @returns A base64url-encoded random string suitable for use as OAuth state parameter
 */
export function generateSecureState(): string {
  // Generate 32 bytes of cryptographically secure random data
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  
  // Convert to base64url encoding (URL-safe, no padding)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a secure random token for general use
 * @param length Length in bytes (default: 32)
 * @returns A hex-encoded random string
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}