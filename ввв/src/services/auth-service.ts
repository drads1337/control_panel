
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { clearCsrfToken } from '@/lib/csrf'
import type { User } from '@/entities/user'

/**
 * SECURITY: Этот сервис больше НЕ использует localStorage для хранения данных пользователя.
 * 
 * Изменения для безопасности:
 * - Удалено хранение пользователя в localStorage (защита от XSS)
 * - Используется только memory cache (Map)
 * - React Query управляет кэшированием данных пользователя
 * 
 * Это защищает от:
 * - XSS атак (кража токенов/данных из localStorage)
 * - Утечки PII (Personally Identifiable Information)
 * - Устаревших данных пользователя
 */

const CACHE_TTL = 15 * 60 * 1000
const API_CALL_DEBOUNCE = 3000

const userCache = new Map<string, { user: User; timestamp: number }>()

let lastApiCall = 0

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
  
  try {
    localStorage.removeItem('user_cache')
  } catch (error) {
  }
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
    // SECURITY: Используем только memory cache
    // localStorage больше не используется для безопасности

    const cachedUser = getUserFromMemoryCache()
    if (cachedUser) {
      return cachedUser
    }

    if (shouldDebounceApiCall()) {
      return null
    }

    try {
      const response = await api.get(API_ENDPOINTS.ME, {
        timeout: 5000, // Увеличиваем таймаут для более надежной работы при перезагрузке
        signal: abortController?.signal
      })

      const userData = response.data

      saveUserToMemoryCache(userData)
      return userData
    } catch (error: unknown) {
      const { isAxiosError, getErrorStatus } = await import('@/lib/error-utils')
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        return null
      }

      const status = getErrorStatus(error)
      
      // 401 означает, что пользователь действительно не авторизован
      // В этом случае возвращаем null, чтобы показать, что сессия истекла
      if (status === 401) {
        return null
      }
      
      if (status === 429) {
        const cached = getUserFromMemoryCache()
        if (cached) {
          return cached
        }
        throw new Error('Rate limited and no cached data available')
      }
      
      // Для других ошибок (сетевые, таймауты, 500 и т.д.) пробуем повторить запрос
      // Это помогает при перезагрузке страницы, когда CSRF токен еще не загружен
      // или есть временные сетевые проблемы
      if (status === 403 || status === 0 || !status || (status >= 500 && status < 600)) {
        // 403 может быть CSRF ошибкой, 0 или отсутствие status - сетевая ошибка
        // 5xx - серверные ошибки, которые могут быть временными
        // Делаем несколько попыток с увеличивающейся задержкой
        const maxRetries = 2
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          // Увеличивающаяся задержка: 300ms, 600ms
          await new Promise(resolve => setTimeout(resolve, 300 * attempt))
          
          if (abortController?.signal.aborted) {
            return null
          }
          
          try {
            const retryResponse = await api.get(API_ENDPOINTS.ME, {
              timeout: 5000,
              signal: abortController?.signal
            })
            
            const retryUserData = retryResponse.data
            saveUserToMemoryCache(retryUserData)
            return retryUserData
          } catch (retryError: unknown) {
            const retryStatus = getErrorStatus(retryError)
            // Если при повторной попытке получили 401, значит пользователь не авторизован
            if (retryStatus === 401) {
              return null
            }
            // Если это последняя попытка, возвращаем null
            if (attempt === maxRetries) {
              return null
            }
            // Иначе продолжаем попытки
          }
        }
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
        return userData
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'CanceledError') {
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

  getCachedUserFromMemory(): User | null {
    return getUserFromMemoryCache()
  }

  saveUserToCache(user: User): void { 
    saveUserToMemoryCache(user)
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