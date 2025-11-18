
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { clearCsrfToken } from '@/lib/csrf'
import type { User } from '@/entities/user'

const CACHE_TTL = 15 * 60 * 1000
const API_CALL_DEBOUNCE = 3000

const userCache = new Map<string, { user: User; timestamp: number }>()

let lastApiCall = 0

function saveUserToLocalStorage(user: User): void {
  try {
    const cacheData = {
      user,
      timestamp: Date.now()
    }
    const serialized = JSON.stringify(cacheData)
    localStorage.setItem('user_cache', serialized)

  } catch (error) {

  }
}

function getUserFromLocalStorage(): { user: User; timestamp: number } | null {
  try {
    const cached = localStorage.getItem('user_cache')

    if (cached) {
      const data = JSON.parse(cached)
      const timeDiff = Date.now() - data.timestamp

      if (data.user && data.timestamp && timeDiff < CACHE_TTL) {

        return data
      } else {

        localStorage.removeItem('user_cache')
      }
    } else {

    }
  } catch (error) {

    localStorage.removeItem('user_cache')
  }
  return null
}

function clearUserFromLocalStorage(): void {
  try {
    localStorage.removeItem('user_cache')

  } catch (error) {

  }
}

function getUserFromMemoryCache(cacheKey: string = 'current_user'): User | null {
  const cached = userCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user
  }
  return null
}

function saveUserToMemoryCache(user: User, cacheKey: string = 'current_user'): void {
  userCache.set(cacheKey, { user, timestamp: Date.now() })
}

function clearAllCaches(): void {
  userCache.clear()
  clearUserFromLocalStorage()
}

function shouldDebounceApiCall(): boolean {
  const now = Date.now()
  if (now - lastApiCall < API_CALL_DEBOUNCE) {
    return true
  }
  lastApiCall = now
  return false
}

export class AuthService {

  async getCurrentUser(abortController?: AbortController): Promise<User | null> {

    const localStorageUser = getUserFromLocalStorage()
    if (localStorageUser) {

      saveUserToMemoryCache(localStorageUser.user)
      return localStorageUser.user
    }

    const cachedUser = getUserFromMemoryCache()
    if (cachedUser) {
      return cachedUser
    }

    if (shouldDebounceApiCall()) {

      return null
    }

    try {
      const response = await api.get(API_ENDPOINTS.ME, {
        timeout: 3000,
        signal: abortController?.signal
      })

      const userData = response.data

      saveUserToMemoryCache(userData)
      saveUserToLocalStorage(userData)
      return userData
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {

        return null
      }

      if (error.response?.status === 429) {

        const cached = getUserFromMemoryCache()
        if (cached) {

          return cached
        }
        throw new Error('Rate limited and no cached data available')
      }

    }

    return null
  }

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

    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, { username, password }, {
        timeout: 5000,
        signal: abortController?.signal
      })
      return response.data
    } catch (error: any) {

      if (error.response?.status !== 401 && error.response?.status !== 403) {
        throw error
      }

      try {
        const response = await api.post('/api/classic_connect', { username, password }, {
          timeout: 5000,
          signal: abortController?.signal
        })
        return response.data
      } catch (connectError: any) {

        const errorData = connectError.response?.data || {}
        throw new Error(errorData.msg || errorData.error || 'Login failed')
      }
    }
  }

  async getFullUserData(
    abortController?: AbortController
  ): Promise<User | null> {

    const cached = getUserFromMemoryCache()
    if (cached) {

      return cached
    }

    try {
      const response = await api.get(API_ENDPOINTS.ME, {
        timeout: 3000,
        signal: abortController?.signal
      })

      if (!abortController?.signal.aborted) {
        const userData = response.data

        saveUserToMemoryCache(userData)
        saveUserToLocalStorage(userData)
        return userData
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {

      }
    }

    return null
  }

  async logout(): Promise<void> {

    clearAllCaches()
    clearCsrfToken()

    try {
      await api.post(API_ENDPOINTS.LOGOUT, {}, {
        timeout: 3000
      })

    } catch (error) {

    }
  }

  clearCache(): void {
    clearAllCaches()
  }

  getCachedUser(): { user: User; timestamp: number } | null {
    return getUserFromLocalStorage()
  }

  getCachedUserFromMemory(): User | null {
    return getUserFromMemoryCache()
  }

  saveUserToCache(user: User): void {
    saveUserToMemoryCache(user)
    saveUserToLocalStorage(user)
  }

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

export const authService = new AuthService()
