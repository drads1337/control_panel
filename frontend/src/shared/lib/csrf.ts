// Use dynamic import to avoid circular dependency with enhanced-client
// enhanced-client imports this module, so we need to import axios directly
import axios from 'axios'
import { getApiBaseUrl } from './utils/index'
import { isAxiosError } from './utils/error-utils'

const CSRF_TOKEN_ENDPOINT = '/api/auth/csrf-token'
const CSRF_TOKEN_CACHE_KEY = 'csrf_token_cache'
const CSRF_TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CsrfTokenCache {
  token: string | null
  timestamp: number
}

/**
 * Get CSRF token from cache or fetch from API
 */
async function getCsrfTokenFromCache(): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(CSRF_TOKEN_CACHE_KEY)
    if (cached) {
      const cache: CsrfTokenCache = JSON.parse(cached)
      const now = Date.now()
      
      // Check if cache is still valid
      if (now - cache.timestamp < CSRF_TOKEN_CACHE_TTL && cache.token) {
        return cache.token
      }
    }
  } catch (error) {
    // Ignore cache errors
  }
  
  return null
}

/**
 * Save CSRF token to cache
 */
function saveCsrfTokenToCache(token: string | null): void {
  try {
    const cache: CsrfTokenCache = {
      token,
      timestamp: Date.now()
    }
    sessionStorage.setItem(CSRF_TOKEN_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    // Ignore cache errors (e.g., if sessionStorage is not available)
  }
}

/**
 * Fetch CSRF token from the API
 */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    // Use axios directly to avoid circular dependency with enhanced-client
    // enhanced-client imports this module, so we can't import it back
    const baseURL = getApiBaseUrl()
    const url = baseURL ? `${baseURL}${CSRF_TOKEN_ENDPOINT}` : CSRF_TOKEN_ENDPOINT
    
    const response = await axios.get<{ csrf_token: string | null }>(url, {
      timeout: 3000,
      withCredentials: true, // Important for cookie-based auth
      // Mark this request as a CSRF fetch
      // @ts-ignore
      __isCsrfFetch: true
    })
    
    const token = (response.data as { csrf_token?: string | null })?.csrf_token || null
    if (token) {
      saveCsrfTokenToCache(token)
    }
    
    return token
  } catch (error: any) {
    // Silently handle CSRF token fetch errors
    // These are expected when not authenticated
    if (error?.response?.status === 401) {
      // Not authenticated - this is expected
      return null
    }
    
    // For other errors, return null and let the caller handle it
    return null
  }
}

/**
 * Get CSRF token (from cache or API)
 */
export async function getCsrfToken(): Promise<string | null> {
  // Try cache first
  const cached = await getCsrfTokenFromCache()
  if (cached) {
    return cached
  }
  
  // Fetch from API if not in cache
  return await fetchCsrfToken()
}

/**
 * Prefetch CSRF token (non-blocking)
 */
export async function prefetchCsrfToken(): Promise<string | null> {
  // Clear cache first to ensure fresh token
  clearCsrfToken()
  return await fetchCsrfToken()
}

/**
 * Get CSRF headers for API requests
 */
export async function getCsrfHeaders(): Promise<{ 'X-CSRFToken'?: string }> {
  const token = await getCsrfToken()
  
  if (token) {
    return {
      'X-CSRFToken': token
    }
  }
  
  return {}
}

/**
 * Clear CSRF token from cache
 */
export function clearCsrfToken(): void {
  try {
    sessionStorage.removeItem(CSRF_TOKEN_CACHE_KEY)
  } catch (error) {
    // Ignore cache errors
  }
}

/**
 * Check if an error is CSRF-related
 */
export function isCsrfError(status: number, errorData?: any): boolean {
  // 403 status can indicate CSRF error
  if (status === 403) {
    if (errorData && typeof errorData === 'object') {
      const errorCode = errorData.error
      const errorMessage = errorData.message || errorData.msg
      
      if (errorCode === 'CSRF_ERROR' || errorCode === 'CSRF_TOKEN_FAILED') {
        return true
      }
      
      if (errorMessage && typeof errorMessage === 'string') {
        if (errorMessage.includes('CSRF') || errorMessage.includes('csrf token')) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Handle CSRF error
 */
export function handleCsrfError(errorData?: any): never {
  // Clear CSRF token cache on error
  clearCsrfToken()
  
  // Throw a generic error that can be handled by error handlers
  const message = errorData?.message || errorData?.msg || 'CSRF token validation failed'
  throw new Error(message)
}

/**
 * Handle Axios CSRF error
 * Checks if the error is CSRF-related and handles it appropriately
 */
export async function handleAxiosCsrfError(error: unknown): Promise<void> {
  // Check if it's an axios error
  if (!isAxiosError(error)) {
    // Not an axios error, nothing to do
    return
  }
  
  const status = error.response?.status
  const errorData = error.response?.data
  
  // Check if it's a CSRF error
  if (status && isCsrfError(status, errorData)) {
    // Clear CSRF token cache on error
    clearCsrfToken()
    
    // Try to prefetch a new token (non-blocking, don't wait for it)
    prefetchCsrfToken().catch(() => {
      // Silently ignore prefetch errors
    })
  }
}

