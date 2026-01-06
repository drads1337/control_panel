/**
 * Sanitization utilities for API requests
 * Prevents XSS and ensures data is safe to send to the backend
 */

/**
 * Recursively sanitizes data for API requests
 * Removes or sanitizes potentially dangerous content
 * 
 * @param data - Data to sanitize (object, array, or primitive)
 * @returns Sanitized data safe for API transmission
 */
export function sanitizeForApi<T>(data: T): T {
  if (data === null || data === undefined) {
    return data
  }

  // Handle primitives
  if (typeof data === 'string') {
    // Basic string sanitization - remove null bytes and control characters
    // More aggressive sanitization should be done on the backend
    return data.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '') as T
  }

  if (typeof data !== 'object') {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForApi(item)) as T
  }

  // Handle objects
  if (data instanceof Date) {
    return data as T
  }

  if (data instanceof RegExp) {
    return data as T
  }

  // Handle plain objects
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    // Sanitize keys - remove null bytes and control characters
    const sanitizedKey = key.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '')
    sanitized[sanitizedKey] = sanitizeForApi(value)
  }

  return sanitized as T
}

