import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import type { Project } from '@/entities/project';

interface ProjectExpirationStatus {
  isExpired: boolean
  isInGracePeriod: boolean
  gracePeriodDaysLeft: number
  projectName: string
  requiresPayment: boolean
  isDeleted: boolean
}

// Cache keys for project expiration
export const projectExpirationKeys = {
  all: ['project-expiration'] as const,
  status: () => [...projectExpirationKeys.all, 'status'] as const,
}

export function useProjectExpiration() {
  const { user } = useAuthContext()
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Use React Query to check project expiration by querying projects
  // This leverages the existing projects query cache
  const {
    data: projectsData,
    isLoading,
    error,
    refetch: checkProjectExpiration,
  } = useQuery({
    queryKey: projectExpirationKeys.status(),
    queryFn: async () => {
      console.log('Checking project expiration for user:', user?.username)
      
      try {
        const response = await api.get('/api/projects')
        return response.data
      } catch (err: any) {
        // Handle special status codes for project expiration
        if (err.response?.status === 402) {
          // Payment required - project expired but in grace period
          throw { type: 'payment_required', data: err.response.data }
        }
        if (err.response?.status === 410) {
          // Project deleted - grace period expired
          throw { type: 'project_deleted', data: err.response.data }
        }
        // Re-throw other errors
        throw err
      }
    },
    enabled: !!user && !user.roles?.includes('owner'),
    staleTime: 5 * 60 * 1000, // 5 minutes - expiration check doesn't need to be super frequent
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on special expiration errors (402, 410) or auth errors
      if (error?.type === 'payment_required' || 
          error?.type === 'project_deleted' ||
          error?.response?.status === 401 || 
          error?.response?.status === 403) {
        return false
      }
      // Retry up to 1 time for other errors
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  })

  // Calculate expiration status from query result
  const expirationStatus: ProjectExpirationStatus | null = (() => {
    // Owner doesn't need expiration check
    if (user?.roles?.includes('owner')) {
      return null
    }

    // Handle special error types
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'payment_required') {
        const errorData = (error as any).data
        return {
          isExpired: true,
          isInGracePeriod: true,
          gracePeriodDaysLeft: errorData.grace_period_days_left || 0,
          projectName: errorData.project_name || 'Unknown Project',
          requiresPayment: true,
          isDeleted: false,
        }
      }
      if (error.type === 'project_deleted') {
        const errorData = (error as any).data
        return {
          isExpired: true,
          isInGracePeriod: false,
          gracePeriodDaysLeft: 0,
          projectName: errorData.project_name || 'Unknown Project',
          requiresPayment: false,
          isDeleted: true,
        }
      }
    }

    // Handle successful response
    if (projectsData?.projects && projectsData.projects.length > 0) {
      const project = projectsData.projects[0] as Project
      const now = new Date()
      const expiresAt = project.subscription_expires_at 
        ? new Date(project.subscription_expires_at) 
        : null
      
      // Check if project is expired
      if (expiresAt && now > expiresAt) {
        const gracePeriodEnd = new Date(expiresAt.getTime() + 14 * 24 * 60 * 60 * 1000)
        const daysLeft = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        
        if (now <= gracePeriodEnd) {
          // In grace period
          return {
            isExpired: true,
            isInGracePeriod: true,
            gracePeriodDaysLeft: daysLeft,
            projectName: project.name,
            requiresPayment: true,
            isDeleted: false,
          }
        } else {
          // Grace period expired
          return {
            isExpired: true,
            isInGracePeriod: false,
            gracePeriodDaysLeft: 0,
            projectName: project.name,
            requiresPayment: false,
            isDeleted: true,
          }
        }
      }
      
      // Project is active
      return null
    }

    // No projects found or other error
    return null
  })()

  const handlePaymentClick = useCallback(() => {
    window.open('https://your-payment-url.com', '_blank')
  }, [])

  // Wrapper for API calls that may trigger expiration errors
  // The expiration status will be automatically updated by React Query
  const handleApiCall = useCallback(async (apiCall: () => Promise<any>) => {
    try {
      const result = await apiCall()
      return result
    } catch (error: any) {
      // Expiration errors (402, 410) will be caught by React Query automatically
      // We just need to re-throw the error
      throw error
    }
  }, [])

  return {
    expirationStatus,
    showPaymentModal,
    setShowPaymentModal,
    isLoading,
    handlePaymentClick,
    handleApiCall,
    checkProjectExpiration
  }
}
