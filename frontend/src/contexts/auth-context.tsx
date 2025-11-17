import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import type { User } from '@/entities/user'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, referralCode?: string) => Promise<void>
  registerWithInvite: (username: string, password: string, inviteCode: string, projectName?: string) => Promise<void>
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

// Track if we're in a hot reload scenario to suppress warnings
let isHotReloading = false
let hasWarned = false // Track if we've already warned to avoid spam

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    isHotReloading = true
    hasWarned = false // Reset warning flag on hot reload
  })
  import.meta.hot.on('vite:afterUpdate', () => {
    // Reset after a short delay to allow components to re-render
    setTimeout(() => {
      isHotReloading = false
    }, 200)
  })
}

// Components that are known to be inside providers but may render before context is ready
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
    // During hot reload or initial render, the context might be undefined temporarily
    // Return a default context to prevent crashes
    // Only warn once in development and not during hot reload
    if (import.meta.env.DEV && !isHotReloading && !hasWarned) {
      const stack = new Error().stack || ''
      // Check if this is a component that's known to be inside the provider tree
      // These components may render before context is ready during hot reload
      const isKnownComponent = KNOWN_INSIDE_PROVIDER_COMPONENTS.some(name => 
        stack.includes(name)
      )
      
      // Only warn if it's likely a real error (component actually outside provider)
      if (!isKnownComponent) {
        console.warn('useAuthContext called outside AuthProvider - returning default context')
        hasWarned = true // Only warn once per session
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