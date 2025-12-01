
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
    } catch (error: unknown) {
      const { isAxiosError, getErrorStatus } = await import('@/lib/error-utils')
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        return null
      }

      const status = getErrorStatus(error)
      if (status === 429) {
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
    } catch (error: unknown) {
      const { getErrorStatus, isAxiosError } = await import('@/lib/error-utils')
      const status = getErrorStatus(error)
      
      // Check if this is a PROJECT_INACTIVE error - don't try CLASSIC_CONNECT for this
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const errorData = error.response.data as { error_code?: string; error?: string }
        if (errorData.error_code === 'PROJECT_INACTIVE' || errorData.error === 'PROJECT_INACTIVE') {
          throw error
        }
      }
      
      if (status !== 401 && status !== 403) {
        throw error
      }

      try {
        const response = await api.post(API_ENDPOINTS.CLASSIC_CONNECT, { username, password }, {
          timeout: 5000,
          signal: abortController?.signal
        })
        return response.data
      } catch (connectError: unknown) {
        if (isAxiosError(connectError) && connectError.response?.data && typeof connectError.response.data === 'object') {
          const errorData = connectError.response.data as { msg?: string; error?: string }
          throw new Error(errorData.msg || errorData.error || 'Login failed')
        }
        throw new Error('Login failed')
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
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'CanceledError') {
        // Error handling can be added here if needed
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
    projectName?: string,
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

    if (projectName) {
      requestBody.project_name = projectName
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
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw error
      }

      const { isAxiosError, getErrorMessage } = await import('@/lib/error-utils')
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const errorData = error.response.data as { msg?: string; error?: string }
        throw new Error(errorData.msg || errorData.error || getErrorMessage(error))
      }
      throw new Error(getErrorMessage(error))
    }
  }

  async registerWithInvite(
    username: string,
    password: string,
    inviteCode: string,
    email?: string,
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

    if (email?.trim()) {
      registerData.email = email.trim().toLowerCase()
    }

    if (projectName?.trim()) {
      registerData.project_name = projectName.trim()
    }

    try {

      const response = await api.post(API_ENDPOINTS.REGISTER_WITH_INVITE, registerData, {
        timeout: 5000,
        signal: abortController?.signal
      })

      return response.data
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw error
      }

      const { isAxiosError, getErrorMessage } = await import('@/lib/error-utils')
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const errorData = error.response.data as { error?: string; msg?: string }
        throw new Error(errorData.error || errorData.msg || getErrorMessage(error))
      }
      throw new Error(getErrorMessage(error))
    }
  }

  async forgotPassword(
    email: string,
    abortController?: AbortController
  ): Promise<{
    message?: string
    error?: string
  }> {
    try {
      const response = await api.post(
        API_ENDPOINTS.FORGOT_PASSWORD,
        { email: email.trim().toLowerCase() },
        {
          timeout: 5000,
          signal: abortController?.signal
        }
      )
      return response.data
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw error
      }

      const { isAxiosError, getErrorMessage } = await import('@/lib/error-utils')
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const errorData = error.response.data as { error?: string; message?: string }
        throw new Error(errorData.error || errorData.message || getErrorMessage(error))
      }
      throw new Error(getErrorMessage(error))
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    abortController?: AbortController
  ): Promise<{
    message?: string
    error?: string
  }> {
    try {
      const response = await api.post(
        API_ENDPOINTS.RESET_PASSWORD,
        { token: token.trim(), new_password: newPassword },
        {
          timeout: 5000,
          signal: abortController?.signal
        }
      )
      return response.data
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw error
      }

      const { isAxiosError, getErrorMessage } = await import('@/lib/error-utils')
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const errorData = error.response.data as { error?: string; message?: string }
        throw new Error(errorData.error || errorData.message || getErrorMessage(error))
      }
      throw new Error(getErrorMessage(error))
    }
  }
}

export const authService = new AuthService()
