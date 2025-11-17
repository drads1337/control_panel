import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { securityAPI, BlockedIP, BlockedHWID, SecurityStats, CreateIPBlockRequest, CreateHWIDBlockRequest } from '@/lib/api/security'
import { useMutationWithCache } from './use-mutation-helpers'
import { toast } from 'sonner'

// Cache keys
export const securityKeys = {
  all: ['security'] as const,
  blockedIPs: () => [...securityKeys.all, 'blocked-ips'] as const,
  blockedHWIDs: () => [...securityKeys.all, 'blocked-hwids'] as const,
  stats: () => [...securityKeys.all, 'stats'] as const,
}

/**
 * Hook for fetching security statistics
 */
export function useSecurityStats() {
  const {
    data: stats,
    isLoading: loading,
    error,
    refetch,
  } = useQuery<SecurityStats>({
    queryKey: securityKeys.stats(),
    queryFn: () => securityAPI.getSecurityStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return {
    stats: stats || null,
    loading,
    error: error?.message || null,
    refetch,
  }
}

/**
 * Hook for managing blocked IPs
 */
export function useBlockedIPs() {
  const {
    data: blockedIPs = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<BlockedIP[]>({
    queryKey: securityKeys.blockedIPs(),
    queryFn: () => securityAPI.getBlockedIPs(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Mutations with automatic cache invalidation
  const blockIPMutation = useMutationWithCache({
    mutationFn: (data: CreateIPBlockRequest) => securityAPI.blockIP(data),
    invalidateQueries: [securityKeys.blockedIPs(), securityKeys.stats()],
    successMessage: 'IP address blocked successfully',
    errorMessage: 'Failed to block IP address',
  })

  const unblockIPMutation = useMutationWithCache({
    mutationFn: (ipId: number) => securityAPI.unblockIP(ipId),
    invalidateQueries: [securityKeys.blockedIPs(), securityKeys.stats()],
    successMessage: 'IP address unblocked successfully',
    errorMessage: 'Failed to unblock IP address',
  })

  const blockIP = React.useCallback(async (data: CreateIPBlockRequest) => {
    try {
      return await blockIPMutation.mutateAsync(data)
    } catch (error) {
      throw error
    }
  }, [blockIPMutation])

  const unblockIP = React.useCallback(async (ipId: number) => {
    try {
      await unblockIPMutation.mutateAsync(ipId)
    } catch (error) {
      throw error
    }
  }, [unblockIPMutation])

  return {
    blockedIPs: Array.isArray(blockedIPs) ? blockedIPs : [],
    loading,
    error: error?.message || null,
    blockIP,
    unblockIP,
    refetch,
  }
}

/**
 * Hook for managing blocked HWIDs
 */
export function useBlockedHWIDs() {
  const {
    data: blockedHWIDs = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<BlockedHWID[]>({
    queryKey: securityKeys.blockedHWIDs(),
    queryFn: () => securityAPI.getBlockedHWIDs(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Mutations with automatic cache invalidation
  const blockHWIDMutation = useMutationWithCache({
    mutationFn: (data: CreateHWIDBlockRequest) => securityAPI.blockHWID(data),
    invalidateQueries: [securityKeys.blockedHWIDs(), securityKeys.stats()],
    successMessage: 'Hardware ID blocked successfully',
    errorMessage: 'Failed to block hardware ID',
  })

  const unblockHWIDMutation = useMutationWithCache({
    mutationFn: (hwidId: number) => securityAPI.unblockHWID(hwidId),
    invalidateQueries: [securityKeys.blockedHWIDs(), securityKeys.stats()],
    successMessage: 'Hardware ID unblocked successfully',
    errorMessage: 'Failed to unblock hardware ID',
  })

  const blockHWID = React.useCallback(async (data: CreateHWIDBlockRequest) => {
    try {
      return await blockHWIDMutation.mutateAsync(data)
    } catch (error) {
      throw error
    }
  }, [blockHWIDMutation])

  const unblockHWID = React.useCallback(async (hwidId: number) => {
    try {
      await unblockHWIDMutation.mutateAsync(hwidId)
    } catch (error) {
      throw error
    }
  }, [unblockHWIDMutation])

  return {
    blockedHWIDs: Array.isArray(blockedHWIDs) ? blockedHWIDs : [],
    loading,
    error: error?.message || null,
    blockHWID,
    unblockHWID,
    refetch,
  }
}



