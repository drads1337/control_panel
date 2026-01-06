/**
 * Sanitization utilities for safe string handling
 */

export function sanitizeString(str: string | null | undefined): string {
  if (!str) return '';
  return String(str).trim();
}
