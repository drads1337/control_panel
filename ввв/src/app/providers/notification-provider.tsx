import React, { createContext, useContext, ReactNode } from 'react'
import { useCustomNotifications } from '@/shared/hooks/use-custom-notifications'

type NotificationContextType = ReturnType<typeof useCustomNotifications>

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notificationMethods = useCustomNotifications()

  return (
    <NotificationContext.Provider value={notificationMethods}>
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

