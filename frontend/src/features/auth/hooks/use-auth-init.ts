import { useEffect, useRef } from 'react'
import { authService } from '@/shared/api/auth-service'

interface UseAuthInitParams {
  setUser: (user: any) => void
  updateState: (updates: any) => void
  onInitialized?: () => void
}

interface UseAuthInitRefs {
  isLoggingIn: React.MutableRefObject<boolean>
  justLoggedIn: React.MutableRefObject<boolean>
  abortControllerRef: React.MutableRefObject<AbortController | null>
  isInitializing: React.MutableRefObject<boolean>
}

export function useAuthInit(
  params: UseAuthInitParams,
  refs: UseAuthInitRefs
) {
  const { setUser, updateState, onInitialized } = params
  const { isLoggingIn, justLoggedIn, abortControllerRef, isInitializing } = refs

  useEffect(() => {
    // Skip if already initializing, logging in, or just logged in
    if (isInitializing.current || isLoggingIn.current || justLoggedIn.current) {
      return
    }

    // Check if user is already in memory cache
    const memoryCachedUser = authService.getCachedUserFromMemory()
    if (memoryCachedUser) {
      setUser(memoryCachedUser)
      updateState({ isLoading: false, isInitialized: true })
      onInitialized?.()
      return
    }

    isInitializing.current = true
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Увеличиваем таймаут fallback, чтобы дать больше времени на восстановление сессии
    const fallbackTimeout = setTimeout(() => {
      if (isInitializing.current) {
        // При таймауте не устанавливаем isAuthenticated: false сразу
        // Позволяем use-auth-redirect решить, нужен ли редирект
        updateState({ isLoading: false, isInitialized: true })
        isInitializing.current = false
        onInitialized?.()
      }
    }, 8000) // Увеличиваем до 8 секунд

    const cleanup = () => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
      clearTimeout(fallbackTimeout)
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      isInitializing.current = false
    }

    // Добавляем небольшую задержку перед первым запросом, чтобы дать время
    // cookies и CSRF токену восстановиться после перезагрузки страницы
    const initDelay = setTimeout(() => {
      if (controller.signal.aborted) {
        return
      }

      authService
        .getCurrentUser(controller)
        .then(userData => {
          // Check if user was set during login while we were fetching
          const currentCachedUser = authService.getCachedUserFromMemory()
          if (currentCachedUser && !userData) {
            setUser(currentCachedUser)
            updateState({
              isLoading: false,
              isInitialized: true,
              error: null
            })
            onInitialized?.()
            return
          }
          
          if (!controller.signal.aborted && userData) {
            setUser(userData)
            updateState({
              isLoading: false,
              isInitialized: true,
              error: null
            })
            onInitialized?.()
          } else if (!userData) {
            // Check one more time if user was set
            const finalCachedUser = authService.getCachedUserFromMemory()
            if (finalCachedUser) {
              setUser(finalCachedUser)
              updateState({
                isLoading: false,
                isInitialized: true,
                error: null
              })
              onInitialized?.()
            } else {
              // Если userData null после всех попыток, устанавливаем user: null
              // setUser(null) автоматически установит isAuthenticated: false
              setUser(null)
              updateState({
                isLoading: false,
                isInitialized: true,
                error: null
              })
              onInitialized?.()
            }
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError' && !controller.signal.aborted) {
            // Check if user was set during error
            const errorCachedUser = authService.getCachedUserFromMemory()
            if (errorCachedUser) {
              setUser(errorCachedUser)
              updateState({
                isLoading: false,
                isInitialized: true,
                error: null
              })
              onInitialized?.()
            } else {
              // При ошибке после всех попыток устанавливаем user: null
              // setUser(null) автоматически установит isAuthenticated: false
              setUser(null)
              updateState({
                isLoading: false,
                isInitialized: true,
                error: null
              })
              onInitialized?.()
            }
          }
        })
        .finally(() => {
          clearTimeout(fallbackTimeout)
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
          }
          isInitializing.current = false
        })
    }, 200) // Задержка 200ms для восстановления cookies

    return () => {
      clearTimeout(initDelay)
      cleanup()
    }

  }, [])
}