import { randomBytes, createHash } from 'crypto';

/**
 * Service for generating and validating secure share tokens
 * Uses cryptographically secure random bytes with SHA256 hashing
 */

/**
 * Generate a secure random token
 * @returns URL-safe token (32 bytes = 64 hex chars)
 */
export function generateShareToken(): string {
  const bytes = randomBytes(32);
  return bytes.toString('hex');
}

/**
 * Hash a token for storage (never store plaintext tokens)
 * @param token The plaintext token
 * @returns SHA256 hash of the token
 */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token by comparing its hash
 * @param token The plaintext token to verify
 * @param tokenHash The stored hash to compare against
 * @returns true if token matches the hash
 */
export function verifyShareToken(token: string, tokenHash: string): boolean {
  const computedHash = hashShareToken(token);
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(computedHash, tokenHash);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a public URL for a share token
 * @param token The share token
 * @param type Either 'client' or 'case'
 * @returns Full shareable URL
 */
export function generateShareUrl(token: string, type: 'client' | 'case' = 'client'): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/shared/${type}/${token}`;
}

/**
 * Check if a share link has expired
 * @param expiresAt Expiration date (null = never expires)
 * @returns true if link is still valid
 */
export function isShareLinkValid(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return true; // No expiration = always valid
  }
  return new Date() < expiresAt;
}

/**
 * Calculate time remaining until expiration
 * @param expiresAt Expiration date
 * @returns Object with days, hours, minutes remaining (null if expired)
 */
export function getTimeUntilExpiration(expiresAt: Date | null): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
} | null {
  if (!expiresAt) {
    return null;
  }

  const now = new Date();
  if (now >= expiresAt) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
    };
  }

  const diff = expiresAt.getTime() - now.getTime();
  const minutes = Math.floor((diff / 1000) / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    days,
    hours: hours % 24,
    minutes: minutes % 60,
    isExpired: false,
  };
}
