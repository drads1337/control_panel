import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react'
import { toast } from 'sonner'
import {
  setGlobalNotificationHandler,
  clearGlobalNotificationHandler,
  type NotificationType,
  type NotificationOptions,
  type GlobalNotificationHandler,
} from '@/lib/global-notifications'

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void
  showError: (title: string, message?: string, duration?: number) => void
  showWarning: (title: string, message?: string, duration?: number) => void
  showInfo: (title: string, message?: string, duration?: number) => void
  showSuccess: (title: string, message?: string, duration?: number) => void
  triggerProjectExpiration: (status: number, data: any) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const showNotification = useCallback((options: NotificationOptions) => {
    const { title, message, type, duration = 5000 } = options
    
    switch (type) {
      case 'error':
        toast.error(title, {
          description: message,
          duration,
        })
        break
      case 'warning':
        toast.warning(title, {
          description: message,
          duration: duration || 4000,
        })
        break
      case 'info':
        toast.info(title, {
          description: message,
          duration: duration || 3000,
        })
        break
      case 'success':
        toast.success(title, {
          description: message,
          duration: duration || 3000,
        })
        break
      default:
        toast.error(title, {
          description: message,
          duration,
        })
    }
  }, [])

  const showError = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ title, message, type: 'error', duration })
  }, [showNotification])

  const showWarning = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ title, message, type: 'warning', duration })
  }, [showNotification])

  const showInfo = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ title, message, type: 'info', duration })
  }, [showNotification])

  const showSuccess = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ title, message, type: 'success', duration })
  }, [showNotification])

  const triggerProjectExpiration = useCallback((status: number, data: any) => {
    // React Query in useProjectExpiration automatically handles 402/410 errors
    // This function is kept for API compatibility but errors are handled by React Query
    // No need to dispatch CustomEvent as useProjectExpiration uses React Query refetch mechanism
    console.log('Project expiration triggered:', { status, data })
    // React Query will automatically refetch and catch expiration errors through its query mechanism
  }, [])

  // Register global notification handler so it can be used from non-React code
  useEffect(() => {
    const handler: GlobalNotificationHandler = {
      showNotification,
      showError,
      showWarning,
      showInfo,
      showSuccess,
      triggerProjectExpiration,
    }
    
    setGlobalNotificationHandler(handler)
    
    return () => {
      clearGlobalNotificationHandler()
    }
  }, [showNotification, showError, showWarning, showInfo, showSuccess, triggerProjectExpiration])

  const value: NotificationContextType = {
    showNotification,
    showError,
    showWarning,
    showInfo,
    showSuccess,
    triggerProjectExpiration,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider')
  }
  return context
}

