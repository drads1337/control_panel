import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { getKeysStats } from '@/entities/key/api/key'
import { getProductsCount } from '@/entities/product/api/product'
import { getFileStats } from '@/entities/file/api/file'
import { getAgentStats } from '@/entities/agent/api/agent'
import { hasManagementAccess } from '@/shared/lib/rbac'

export interface ManagementStats {
  totalKeys: number
  activeKeys: number
  expiredKeys: number
  totalProducts: number
  totalFiles: number
  totalAgents: number
}

export const managementStatsKeys = {
  all: ['management-stats'] as const,
  detail: () => [...managementStatsKeys.all, 'stats'] as const,
}

export function useManagementStats() {
  const { isAuthenticated, user } = useAuthContext()

  const permissionChecks = hasManagementAccess(user)
  const { canViewKeys, canViewFiles, canViewProducts, canViewAgents, hasAccess } = permissionChecks

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: managementStatsKeys.detail(),
    queryFn: async (): Promise<ManagementStats> => {
      const statsData: ManagementStats = {
        totalKeys: 0,
        activeKeys: 0,
        expiredKeys: 0,
        totalProducts: 0,
        totalFiles: 0,
        totalAgents: 0,
      }

      const promises: Promise<unknown>[] = []
      const promiseHandlers: Array<{
        handler: (result: any) => void
        errorHandler: (error: any) => void
      }> = []

      if (canViewKeys) {
        promises.push(getKeysStats())
        promiseHandlers.push({
          handler: (keysStats) => {
            statsData.totalKeys = keysStats.total || 0
            statsData.activeKeys = keysStats.active || 0
            statsData.expiredKeys = keysStats.expired || 0
          },
          errorHandler: (error) => {

          },
        })
      }

      if (canViewProducts) {
        promises.push(getProductsCount('all'))
        promiseHandlers.push({
          handler: (productsCountResponse) => {
            statsData.totalProducts = productsCountResponse.count || 0
          },
          errorHandler: (error) => {

          },
        })
      }

      if (canViewFiles) {
        promises.push(getFileStats())
        promiseHandlers.push({
          handler: (fileStats) => {
            statsData.totalFiles = fileStats.overview?.total_files || 0
          },
          errorHandler: (error) => {

          },
        })
      }

      if (canViewAgents) {
        promises.push(getAgentStats())
        promiseHandlers.push({
          handler: (agentStats) => {
            statsData.totalAgents = agentStats.stats?.total_agents || 0
          },
          errorHandler: (error) => {

          },
        })
      }

      const results = await Promise.allSettled(promises)

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          promiseHandlers[index]?.handler(result.value)
        } else {
          promiseHandlers[index]?.errorHandler(result.reason)
        }
      })

      return statsData
    },
    enabled: isAuthenticated && hasAccess,
    staleTime: 60 * 1000, // Increased to 1 minute - stats don't need to update as frequently
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, // Disabled - stats are not critical for immediate update
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }

      return failureCount < 2
    },
  })

  return {
    stats: stats || {
      totalKeys: 0,
      activeKeys: 0,
      expiredKeys: 0,
      totalProducts: 0,
      totalFiles: 0,
      totalAgents: 0,
    },
    isLoading,
    error,
    refetch,
  }
}
