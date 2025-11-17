/**
 * Authentication Service
 * Handles authentication API calls and caching logic
 * Separated from UI logic to follow Single Responsibility Principle
 */

import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { clearCsrfToken } from '@/lib/csrf'
import type { User } from '@/entities/user'

// Cache configuration
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const API_CALL_DEBOUNCE = 3000 // 3 seconds debounce to prevent rate limiting

// Memory cache for user data
const userCache = new Map<string, { user: User; timestamp: number }>()

// Debounce mechanism to prevent rapid API calls
let lastApiCall = 0

/**
 * Save user data to localStorage cache
 */
function saveUserToLocalStorage(user: User): void {
  try {
    const cacheData = {
      user,
      timestamp: Date.now()
    }
    const serialized = JSON.stringify(cacheData)
    localStorage.setItem('user_cache', serialized)
    console.log('🔐 CACHE: Saved user to localStorage:', {
      user: user.username,
      timestamp: cacheData.timestamp,
      serializedLength: serialized.length
    })
  } catch (error) {
    console.warn('🔐 CACHE: Failed to save user to localStorage:', error)
  }
}

/**
 * Get user data from localStorage cache
 */
function getUserFromLocalStorage(): { user: User; timestamp: number } | null {
  try {
    const cached = localStorage.getItem('user_cache')
    console.log('🔐 CACHE: Checking localStorage:', {
      hasCached: !!cached,
      cacheLength: cached?.length,
      currentTime: Date.now(),
      cacheTTL: CACHE_TTL
    })

    if (cached) {
      const data = JSON.parse(cached)
      const timeDiff = Date.now() - data.timestamp
      console.log('🔐 CACHE: localStorage data:', {
        hasUser: !!data.user,
        hasTimestamp: !!data.timestamp,
        timeDiff,
        isExpired: timeDiff >= CACHE_TTL,
        cacheTTL: CACHE_TTL
      })

      if (data.user && data.timestamp && timeDiff < CACHE_TTL) {
        console.log('🔐 CACHE: Found valid user in localStorage')
        return data
      } else {
        console.log('🔐 CACHE: localStorage cache expired, clearing')
        localStorage.removeItem('user_cache')
      }
    } else {
      console.log('🔐 CACHE: No cached data in localStorage')
    }
  } catch (error) {
    console.warn('🔐 CACHE: Failed to read user from localStorage:', error)
    localStorage.removeItem('user_cache')
  }
  return null
}

/**
 * Clear user data from localStorage cache
 */
function clearUserFromLocalStorage(): void {
  try {
    localStorage.removeItem('user_cache')
    console.log('🔐 CACHE: Cleared user from localStorage')
  } catch (error) {
    console.warn('🔐 CACHE: Failed to clear user from localStorage:', error)
  }
}

/**
 * Get user from memory cache
 */
function getUserFromMemoryCache(cacheKey: string = 'current_user'): User | null {
  const cached = userCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user
  }
  return null
}

/**
 * Save user to memory cache
 */
function saveUserToMemoryCache(user: User, cacheKey: string = 'current_user'): void {
  userCache.set(cacheKey, { user, timestamp: Date.now() })
}

/**
 * Clear all caches
 */
function clearAllCaches(): void {
  userCache.clear()
  clearUserFromLocalStorage()
}

/**
 * Check if we should debounce API calls
 */
function shouldDebounceApiCall(): boolean {
  const now = Date.now()
  if (now - lastApiCall < API_CALL_DEBOUNCE) {
    return true
  }
  lastApiCall = now
  return false
}

/**
 * Authentication Service Class
 */
export class AuthService {
  /**
   * Get current user with caching
   * Checks localStorage, memory cache, and then makes API call if needed
   */
  async getCurrentUser(abortController?: AbortController): Promise<User | null> {
    // Check localStorage first
    const localStorageUser = getUserFromLocalStorage()
    if (localStorageUser) {
      // Also update memory cache
      saveUserToMemoryCache(localStorageUser.user)
      return localStorageUser.user
    }

    // Check memory cache
    const cachedUser = getUserFromMemoryCache()
    if (cachedUser) {
      return cachedUser
    }

    // Debounce API calls to prevent rate limiting
    if (shouldDebounceApiCall()) {
      console.log('🔐 AUTH SERVICE: API call debounced, returning null')
      return null
    }

    try {
      const response = await api.get(API_ENDPOINTS.ME, {
        timeout: 3000,
        signal: abortController?.signal
      })

      const userData = response.data
      // Cache in both memory and localStorage
      saveUserToMemoryCache(userData)
      saveUserToLocalStorage(userData)
      return userData
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        // Request was aborted, don't log as error
        return null
      }
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        // Rate limited - try to use cached data
        const cached = getUserFromMemoryCache()
        if (cached) {
          console.log('⚠️ AUTH SERVICE: Rate limited, using cached data')
          return cached
        }
        throw new Error('Rate limited and no cached data available')
      }
      
      console.warn('🔐 AUTH SERVICE: Failed to get user data:', error)
    }

    return null
  }

  /**
   * Login user
   * Returns user data and login success status
   */
  async login(
    username: string,
    password: string,
    abortController?: AbortController
  ): Promise<{
    login_success: boolean
    user_id?: string
    username?: string
    roles?: string[]
    role?: string
    first_name?: string
    last_name?: string
    email?: string
    avatar?: string
    expires_at?: string
    last_login?: string
    last_ip?: string
    last_country?: string
    last_city?: string
    total_keys_generated?: number
    token_balance?: number
    project_id?: number | null
    keys_count?: number
    active_keys?: number
    referral_code?: string
    invited_by?: number | null
    created_at?: string
    updated_at?: string
    rbac_roles?: string[]
    login_type?: string
  }> {
    // First try regular login
    // CSRF token is automatically added by axios interceptor
    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, { username, password }, {
        timeout: 5000,
        signal: abortController?.signal
      })
      return response.data
    } catch (error: any) {
      // If regular login fails, try classic connect for web
      // NOTE: /api/classic_connect now uses the same security protections as /api/auth/login
      // through process_simple_login() (brute-force protection, IP blocking, session limits, etc.)
      // See: backend/routes/connect/connect.py::classic_connect() for details
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        throw error
      }

      console.log('🔄 AUTH SERVICE: Regular login failed, trying classic connect...')
      try {
        const response = await api.post('/api/classic_connect', { username, password }, {
          timeout: 5000,
          signal: abortController?.signal
        })
        return response.data
      } catch (connectError: any) {
        // If both fail, throw error
        const errorData = connectError.response?.data || {}
        throw new Error(errorData.msg || errorData.error || 'Login failed')
      }
    }
  }

  /**
   * Get full user data after login
   * Uses cache if available to avoid rate limiting
   */
  async getFullUserData(
    abortController?: AbortController
  ): Promise<User | null> {
    // Check if we can use cached data to avoid rate limiting
    const cached = getUserFromMemoryCache()
    if (cached) {
      console.log('✅ AUTH SERVICE: Using cached user data to avoid rate limiting')
      return cached
    }

    // Make API call to get full user data
    try {
      const response = await api.get(API_ENDPOINTS.ME, {
        timeout: 3000,
        signal: abortController?.signal
      })

      if (!abortController?.signal.aborted) {
        const userData = response.data
        // Cache the user data in both memory and localStorage
        saveUserToMemoryCache(userData)
        saveUserToLocalStorage(userData)
        return userData
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.warn('⚠️ AUTH SERVICE: Failed to get full user info:', error)
      }
    }

    return null
  }

  /**
   * Logout user
   * Clears all caches and calls logout endpoint
   */
  async logout(): Promise<void> {
    // Clear all caches immediately
    clearAllCaches()
    clearCsrfToken()

    // Call logout endpoint to clear httpOnly cookies
    // CSRF token is automatically added by axios interceptor
    try {
      await api.post(API_ENDPOINTS.LOGOUT, {}, {
        timeout: 3000
      })
      console.log('🔐 AUTH SERVICE: Logout endpoint called successfully')
    } catch (error) {
      console.warn('🔐 AUTH SERVICE: Failed to call logout endpoint:', error)
      // Don't fail the logout process if the endpoint fails
    }
  }

  /**
   * Clear all authentication caches
   */
  clearCache(): void {
    clearAllCaches()
  }

  /**
   * Get cached user from localStorage (for initialization)
   */
  getCachedUser(): { user: User; timestamp: number } | null {
    return getUserFromLocalStorage()
  }

  /**
   * Get cached user from memory cache
   */
  getCachedUserFromMemory(): User | null {
    return getUserFromMemoryCache()
  }

  /**
   * Save user to cache (both memory and localStorage)
   */
  saveUserToCache(user: User): void {
    saveUserToMemoryCache(user)
    saveUserToLocalStorage(user)
  }

  /**
   * Register user (standard registration)
   * @param username - Username
   * @param email - User email
   * @param password - User password
   * @param referralCode - Optional referral code
   */
  async register(
    username: string,
    email: string,
    password: string,
    referralCode?: string,
    abortController?: AbortController
  ): Promise<{
    success?: boolean
    error?: string
    msg?: string
    [key: string]: any
  }> {
    const requestBody: any = {
      username,
      email,
      password
    }

    if (referralCode) {
      requestBody.referral_code = referralCode
    }

    try {
      // CSRF token is automatically added by axios interceptor
      const response = await api.post(API_ENDPOINTS.REGISTER, requestBody, {
        timeout: 5000,
        signal: abortController?.signal
      })

      return response.data
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        throw error
      }
      
      const errorData = error.response?.data || {}
      throw new Error(errorData.msg || errorData.error || error.message || 'Registration failed')
    }
  }

  /**
   * Register user with invite code
   * @param username - Username
   * @param password - User password
   * @param inviteCode - Invite code
   * @param projectName - Optional project name (required for some project invite codes)
   */
  async registerWithInvite(
    username: string,
    password: string,
    inviteCode: string,
    projectName?: string,
    abortController?: AbortController
  ): Promise<{
    success?: boolean
    error?: string
    msg?: string
    [key: string]: any
  }> {
    const registerData: any = {
      username: username.trim(),
      password,
      invite_code: inviteCode.trim()
    }

    if (projectName?.trim()) {
      registerData.project_name = projectName.trim()
    }

    try {
      // CSRF token is automatically added by axios interceptor
      const response = await api.post('/api/auth/register-with-invite', registerData, {
        timeout: 5000,
        signal: abortController?.signal
      })

      return response.data
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        throw error
      }
      
      const errorData = error.response?.data || {}
      throw new Error(errorData.error || errorData.msg || error.message || 'Registration failed')
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

