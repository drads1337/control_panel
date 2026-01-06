/**
 * Shared utility functions
 */

/**
 * Get API base URL from environment or use empty string for dev (proxy handles it)
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) {
    return envUrl
  }
  
  // In development, Vite proxy handles /api, so we use empty string
  // In production, this should be set via VITE_API_BASE_URL
  return import.meta.env.DEV ? '' : ''
}

// Re-export error utilities
// Note: getErrorMessage is also exported from api/enhanced-client
// Use explicit imports if there's ambiguity
export * from './error-utils'

