/**
 * Zod schemas for API error responses
 * 
 * These schemas provide type-safe parsing of error responses from the backend API.
 * This allows us to safely access error.response.data with full type safety,
 * instead of using optional chaining and fallbacks like data?.message || data?.error.
 * 
 * SECURITY NOTE: These schemas validate and sanitize error data before use,
 * preventing potential issues from malformed or malicious error responses.
 */

import { z } from 'zod'

/**
 * Base error response schema
 * All API errors follow this structure
 */
export const baseErrorResponseSchema = z.object({
  error: z.string().describe('Error code or type'),
  message: z.string().optional().nullable().describe('Human-readable error message'),
  type: z.string().optional().nullable().describe('Error type identifier'),
})

/**
 * Extended error response schema with additional fields
 * Used for detailed error responses (e.g., 500 errors in debug mode)
 */
export const detailedErrorResponseSchema = baseErrorResponseSchema.extend({
  details: z.union([
    z.string(),
    z.record(z.unknown()),
    z.array(z.unknown()),
  ]).optional().nullable().describe('Additional error details'),
  traceback: z.array(z.string()).optional().nullable().describe('Stack trace (debug mode only)'),
  source: z.string().optional().nullable().describe('Error source identifier'),
})

/**
 * CSRF error response schema
 * Specific structure for CSRF validation failures
 */
export const csrfErrorResponseSchema = z.object({
  error: z.literal('CSRF_ERROR'),
  message: z.string().optional().nullable(),
  msg: z.string().optional().nullable(),
})

/**
 * Authentication error response schema
 * Used for 401 Unauthorized responses
 */
export const authErrorResponseSchema = z.object({
  error: z.string(),
  msg: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
})

/**
 * Rate limit error response schema
 * Used for 429 Too Many Requests responses
 */
export const rateLimitErrorResponseSchema = z.object({
  error: z.literal('Too many requests').or(z.string()),
  type: z.literal('rate_limit_exceeded').optional().nullable(),
  message: z.string().optional().nullable(),
})

/**
 * Validation error response schema
 * Used for 400 Bad Request responses with validation errors
 */
export const validationErrorResponseSchema = baseErrorResponseSchema.extend({
  errors: z.array(z.string()).optional().nullable().describe('List of validation error messages'),
  details: z.record(z.unknown()).optional().nullable().describe('Field-specific validation errors'),
})

/**
 * Not found error response schema
 * Used for 404 Not Found responses
 */
export const notFoundErrorResponseSchema = z.object({
  error: z.literal('Resource not found').or(z.string()),
  type: z.literal('not_found').optional().nullable(),
  message: z.string().optional().nullable(),
})

/**
 * Method not allowed error response schema
 * Used for 405 Method Not Allowed responses
 */
export const methodNotAllowedErrorResponseSchema = z.object({
  error: z.literal('Method not allowed').or(z.string()),
  type: z.literal('method_not_allowed').optional().nullable(),
  message: z.string().optional().nullable(),
})

/**
 * Union type for all possible error response schemas
 * This allows parsing any error response structure
 */
export const apiErrorResponseSchema = z.union([
  csrfErrorResponseSchema,
  authErrorResponseSchema,
  rateLimitErrorResponseSchema,
  validationErrorResponseSchema,
  notFoundErrorResponseSchema,
  methodNotAllowedErrorResponseSchema,
  detailedErrorResponseSchema,
  baseErrorResponseSchema,
])

/**
 * Type inference from the error response schema
 */
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
export type BaseErrorResponse = z.infer<typeof baseErrorResponseSchema>
export type DetailedErrorResponse = z.infer<typeof detailedErrorResponseSchema>
export type CsrfErrorResponse = z.infer<typeof csrfErrorResponseSchema>
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>
export type RateLimitErrorResponse = z.infer<typeof rateLimitErrorResponseSchema>
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>
export type NotFoundErrorResponse = z.infer<typeof notFoundErrorResponseSchema>
export type MethodNotAllowedErrorResponse = z.infer<typeof methodNotAllowedErrorResponseSchema>

/**
 * Safe parser for error responses
 * Returns a typed error response or null if parsing fails
 * 
 * @param data - The error response data to parse
 * @returns Parsed and validated error response, or null if parsing fails
 * 
 * @example
 * ```ts
 * const errorData = parseErrorResponse(error.response?.data)
 * if (errorData) {
 *   console.log(errorData.message || errorData.error)
 * }
 * ```
 */
export function parseErrorResponse(data: unknown): ApiErrorResponse | null {
  try {
    return apiErrorResponseSchema.parse(data)
  } catch {
    // If parsing fails, return null
    // This is safe because we'll fall back to generic error handling
    return null
  }
}

/**
 * Safe parser that returns the error response or a fallback
 * 
 * @param data - The error response data to parse
 * @param fallback - Fallback error response if parsing fails
 * @returns Parsed error response or fallback
 */
export function parseErrorResponseWithFallback(
  data: unknown,
  fallback: BaseErrorResponse = { error: 'Unknown error' }
): ApiErrorResponse {
  const parsed = parseErrorResponse(data)
  return parsed || fallback
}

