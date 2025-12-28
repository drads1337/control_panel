
import { z } from 'zod'

export const baseErrorResponseSchema = z.object({
  error: z.string().describe('Error code or type'),
  message: z.string().optional().nullable().describe('Human-readable error message'),
  type: z.string().optional().nullable().describe('Error type identifier'),
})

export const detailedErrorResponseSchema = baseErrorResponseSchema.extend({
  details: z.union([
    z.string(),
    z.record(z.unknown()),
    z.array(z.unknown()),
  ]).optional().nullable().describe('Additional error details'),
  traceback: z.array(z.string()).optional().nullable().describe('Stack trace (debug mode only)'),
  source: z.string().optional().nullable().describe('Error source identifier'),
})

export const csrfErrorResponseSchema = z.object({
  error: z.literal('CSRF_ERROR'),
  message: z.string().optional().nullable(),
  msg: z.string().optional().nullable(),
})

export const authErrorResponseSchema = z.object({
  error: z.string(),
  msg: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
})

export const rateLimitErrorResponseSchema = z.object({
  error: z.literal('Too many requests').or(z.string()),
  type: z.literal('rate_limit_exceeded').optional().nullable(),
  message: z.string().optional().nullable(),
})

export const validationErrorResponseSchema = baseErrorResponseSchema.extend({
  errors: z.array(z.string()).optional().nullable().describe('List of validation error messages'),
  details: z.record(z.unknown()).optional().nullable().describe('Field-specific validation errors'),
})

export const notFoundErrorResponseSchema = z.object({
  error: z.literal('Resource not found').or(z.string()),
  type: z.literal('not_found').optional().nullable(),
  message: z.string().optional().nullable(),
})

export const methodNotAllowedErrorResponseSchema = z.object({
  error: z.literal('Method not allowed').or(z.string()),
  type: z.literal('method_not_allowed').optional().nullable(),
  message: z.string().optional().nullable(),
})

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

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
export type BaseErrorResponse = z.infer<typeof baseErrorResponseSchema>
export type DetailedErrorResponse = z.infer<typeof detailedErrorResponseSchema>
export type CsrfErrorResponse = z.infer<typeof csrfErrorResponseSchema>
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>
export type RateLimitErrorResponse = z.infer<typeof rateLimitErrorResponseSchema>
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>
export type NotFoundErrorResponse = z.infer<typeof notFoundErrorResponseSchema>
export type MethodNotAllowedErrorResponse = z.infer<typeof methodNotAllowedErrorResponseSchema>

export function parseErrorResponse(data: unknown): ApiErrorResponse | null {
  try {
    return apiErrorResponseSchema.parse(data)
  } catch {

    return null
  }
}

export function parseErrorResponseWithFallback(
  data: unknown,
  fallback: BaseErrorResponse = { error: 'Unknown error' }
): ApiErrorResponse {
  const parsed = parseErrorResponse(data)
  return parsed || fallback
}
