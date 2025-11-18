import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { getKeysStats } from '@/entities/key/api/key'
import { getGames } from '@/entities/game/api/game'
import { getFileStats } from '@/entities/file/api/file'
import { getLoaderStats } from '@/entities/loader/api/loader'
import { hasManagementAccess } from '@/lib/rbac-utils'

export interface ManagementStats {
  totalKeys: number
  activeKeys: number
  expiredKeys: number
  totalGames: number
  totalFiles: number
  totalLoaders: number
}

export const managementStatsKeys = {
  all: ['management-stats'] as const,
  detail: () => [...managementStatsKeys.all, 'stats'] as const,
}

export function useManagementStats() {
  const { isAuthenticated, user } = useAuthContext()

  const permissionChecks = hasManagementAccess(user)
  const { canViewKeys, canViewFiles, canViewGames, canViewLoaders, hasAccess } = permissionChecks

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
        totalGames: 0,
        totalFiles: 0,
        totalLoaders: 0,
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

      if (canViewGames) {
        promises.push(getGames())
        promiseHandlers.push({
          handler: (gamesResponse) => {
            statsData.totalGames = gamesResponse.games?.length || 0
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

      if (canViewLoaders) {
        promises.push(getLoaderStats())
        promiseHandlers.push({
          handler: (loaderStats) => {
            statsData.totalLoaders = loaderStats.stats?.total_loaders || 0
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
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
      totalGames: 0,
      totalFiles: 0,
      totalLoaders: 0,
    },
    isLoading,
    error,
    refetch,
  }
}
