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

// Cache keys
export const managementStatsKeys = {
  all: ['management-stats'] as const,
  detail: () => [...managementStatsKeys.all, 'stats'] as const,
}

export function useManagementStats() {
  const { isAuthenticated, user } = useAuthContext()
  
  // Check if user has access to management
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

      // Build array of promises for parallel execution
      const promises: Promise<unknown>[] = []
      const promiseHandlers: Array<{
        handler: (result: any) => void
        errorHandler: (error: any) => void
      }> = []

      // Load keys stats only if user has permission
      if (canViewKeys) {
        promises.push(getKeysStats())
        promiseHandlers.push({
          handler: (keysStats) => {
            statsData.totalKeys = keysStats.total || 0
            statsData.activeKeys = keysStats.active || 0
            statsData.expiredKeys = keysStats.expired || 0
          },
          errorHandler: (error) => {
            console.warn('Failed to load keys stats:', error)
          },
        })
      }

      // Load games only if user has permission
      if (canViewGames) {
        promises.push(getGames())
        promiseHandlers.push({
          handler: (gamesResponse) => {
            statsData.totalGames = gamesResponse.games?.length || 0
          },
          errorHandler: (error) => {
            console.warn('Failed to load games:', error)
          },
        })
      }

      // Load file stats only if user has permission
      if (canViewFiles) {
        promises.push(getFileStats())
        promiseHandlers.push({
          handler: (fileStats) => {
            statsData.totalFiles = fileStats.overview?.total_files || 0
          },
          errorHandler: (error) => {
            console.warn('Failed to load file stats:', error)
          },
        })
      }

      // Load loader stats only if user has permission
      if (canViewLoaders) {
        promises.push(getLoaderStats())
        promiseHandlers.push({
          handler: (loaderStats) => {
            statsData.totalLoaders = loaderStats.stats?.total_loaders || 0
          },
          errorHandler: (error) => {
            console.warn('Failed to load loader stats:', error)
          },
        })
      }

      // Execute all promises in parallel and handle each result independently
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
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401, 403)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Retry up to 2 times for other errors
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

