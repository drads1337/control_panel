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

  // Мемоизируем значение контекста для предотвращения лишних перерисовок
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

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    // During hot reload, the context might be undefined temporarily
    // Return a default context to prevent crashes
    console.warn('useAuthContext called outside AuthProvider - returning default context')
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