import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { useAuth } from '@/lib/hooks'
import type { User } from '@/entities/user'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, projectName?: string, referralCode?: string) => Promise<void>
  registerWithInvite: (username: string, password: string, inviteCode: string, email?: string, projectName?: string) => Promise<void>
  logout: () => void
  clearError: () => void
  updateUser: (userData: any) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const contextValue = useMemo(() => ({
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    isInitialized: auth.isInitialized,
    login: auth.login,
    register: auth.register,
    registerWithInvite: auth.registerWithInvite,
    logout: auth.logout,
    clearError: auth.clearError,
    updateUser: auth.updateUser
  }), [
    auth.user,
    auth.token,
    auth.isAuthenticated,
    auth.isLoading,
    auth.error,
    auth.isInitialized,
    auth.login,
    auth.register,
    auth.registerWithInvite,
    auth.logout,
    auth.clearError,
    auth.updateUser
  ])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

let isHotReloading = false
let hasWarned = false

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    isHotReloading = true
    hasWarned = false
  })
  import.meta.hot.on('vite:afterUpdate', () => {

    setTimeout(() => {
      isHotReloading = false
    }, 200)
  })
}

const KNOWN_INSIDE_PROVIDER_COMPONENTS = [
  'QueryErrorHandler',
  'ColorInitializer',
  'AppContent',
  'AuthGuard',
  'useProjectExpiration',
  'useSettingsQuery',
  'useCustomColor'
]

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {

    if (import.meta.env.DEV && !isHotReloading && !hasWarned) {
      const stack = new Error().stack || ''

      const isKnownComponent = KNOWN_INSIDE_PROVIDER_COMPONENTS.some(name => 
        stack.includes(name)
      )

      if (!isKnownComponent) {

        hasWarned = true
      }
    }

    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      isInitialized: false,
      login: async () => {},
      register: async () => {},
      registerWithInvite: async () => {},
      logout: () => {},
      clearError: () => {},
      updateUser: () => {}
    }
  }
  return context
}

