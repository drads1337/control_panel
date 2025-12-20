import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { getErrorStatus, isAxiosError } from '@/lib/utils/error-utils'
import type { Project } from '@/entities/project';

interface ProjectExpirationStatus {
  isExpired: boolean
  isInGracePeriod: boolean
  gracePeriodDaysLeft: number
  projectName: string
  requiresPayment: boolean
  isDeleted: boolean
}

export const projectExpirationKeys = {
  all: ['project-expiration'] as const,
  status: () => [...projectExpirationKeys.all, 'status'] as const,
}

export function useProjectExpiration() {
  const { user } = useAuthContext()
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const {
    data: projectsData,
    isLoading,
    error,
    refetch: checkProjectExpiration,
  } = useQuery({
    queryKey: projectExpirationKeys.status(),
    queryFn: async () => {

      try {
        const response = await api.get('/api/projects')
        return response.data
      } catch (err: unknown) {
        const status = getErrorStatus(err)
        if (status === 402 && isAxiosError(err)) {
          throw { type: 'payment_required', data: err.response?.data }
        }
        if (status === 410 && isAxiosError(err)) {
          throw { type: 'project_deleted', data: err.response?.data }
        }
        throw err
      }
    },
    enabled: !!user && !user.roles?.includes('owner'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      if (typeof error === 'object' && error !== null) {
        const err = error as { type?: string }
        if (err.type === 'payment_required' || err.type === 'project_deleted') {
          return false
        }
      }
      const status = getErrorStatus(error)
      if (status === 401 || status === 403) {
        return false
      }
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: 5 * 60 * 1000,
  })

  const expirationStatus: ProjectExpirationStatus | null = (() => {

    if (user?.roles?.includes('owner')) {
      return null
    }

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

    if (projectsData?.projects && projectsData.projects.length > 0) {
      const project = projectsData.projects[0] as Project
      const now = new Date()
      const expiresAt = project.subscription_expires_at 
        ? new Date(project.subscription_expires_at) 
        : null

      if (expiresAt && now > expiresAt) {
        const gracePeriodEnd = new Date(expiresAt.getTime() + 14 * 24 * 60 * 60 * 1000)
        const daysLeft = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))

        if (now <= gracePeriodEnd) {

          return {
            isExpired: true,
            isInGracePeriod: true,
            gracePeriodDaysLeft: daysLeft,
            projectName: project.name,
            requiresPayment: true,
            isDeleted: false,
          }
        } else {

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

      return null
    }

    return null
  })()

  const handlePaymentClick = useCallback(() => {
    window.open('https://your-payment-url.com', '_blank')
  }, [])

  const handleApiCall = useCallback(async (apiCall: () => Promise<any>) => {
    try {
      const result = await apiCall()
      return result
    } catch (error: unknown) {
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
