import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteLicenseKey,
  resetLicenseKey,
  pauseLicenseKey,
  resumeLicenseKey,
  blockLicenseKey,
  unblockLicenseKey,
  extendLicenseKey,
  duplicateLicenseKey,
  type LicenseKey,
  type LicenseKeysResponse
} from '@/entities/key'
import { keyKeys } from './use-keys-query'
import { KEY_STATUS } from '@/constants'

function updateAllKeyLists(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (keys: LicenseKey[]) => LicenseKey[]
) {

  const queryCache = queryClient.getQueryCache()
  const listQueries = queryCache.findAll({ queryKey: keyKeys.lists() })

  listQueries.forEach((query) => {
    const data = query.state.data as LicenseKeysResponse | undefined
    if (data?.keys) {
      queryClient.setQueryData(query.queryKey, {
        ...data,
        keys: updater(data.keys),
      })
    }
  })
}

export function useKeyMutations() {
  const queryClient = useQueryClient()

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: number) => deleteLicenseKey(keyId),
    onMutate: async (keyId: number) => {

      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })

      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) => keys.filter((k) => k.id !== keyId))

      const queryCache = queryClient.getQueryCache()
      const listQueries = queryCache.findAll({ queryKey: keyKeys.lists() })
      listQueries.forEach((query) => {
        const data = query.state.data as LicenseKeysResponse | undefined
        if (data) {
          queryClient.setQueryData(query.queryKey, {
            ...data,
            total: Math.max(0, data.total - 1),
          })
        }
      })

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {

      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to delete key')
    },
    onSuccess: () => {
      toast.success('Key deleted successfully')
    },
    onSettled: () => {

      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
    },
  })

  const pauseKeyMutation = useMutation({
    mutationFn: (keyId: number) => pauseLicenseKey(keyId),
    onMutate: async (keyId: number) => {
      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) =>
        keys.map((k) => (k.id === keyId ? { ...k, status: KEY_STATUS.PAUSED } : k))
      )

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to pause key')
    },
    onSuccess: () => {
      toast.success('Key paused successfully')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
    },
  })

  const resumeKeyMutation = useMutation({
    mutationFn: (keyId: number) => resumeLicenseKey(keyId),
    onMutate: async (keyId: number) => {
      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) =>
        keys.map((k) => (k.id === keyId ? { ...k, status: KEY_STATUS.ACTIVE } : k))
      )

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to resume key')
    },
    onSuccess: () => {
      toast.success('Key resumed successfully')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
    },
  })

  const blockKeyMutation = useMutation({
    mutationFn: (keyId: number) => blockLicenseKey(keyId),
    onMutate: async (keyId: number) => {
      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) => {
        const updated = keys.map((k) => {
          if (k.id === keyId || String(k.id) === String(keyId)) {
            const newKey = { ...k, status: KEY_STATUS.BLOCKED, is_expired: false, is_active: false }
            return newKey
          }
          return k
        })
        return updated
      })

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to block key')
    },
    onSuccess: (data: any, keyId: number) => {
      // Update with server response data if available
      if (data?.key) {
        const serverKeyId = String(data.key.id)
        updateAllKeyLists(queryClient, (keys) => {
          const updated = keys.map((k) => {
            // Compare both as strings to handle number/string mismatch
            const keyIdStr = String(k.id)
            if (keyIdStr === serverKeyId || k.id === keyId || keyIdStr === String(keyId)) {
              const merged = { 
                ...k, 
                ...data.key,
                // Ensure status is number
                status: Number(data.key.status),
                // Force is_expired to false for blocked keys (status = 2)
                is_expired: Number(data.key.status) === KEY_STATUS.BLOCKED ? false : (data.key.is_expired ?? k.is_expired),
                is_active: data.key.is_active ?? k.is_active
              }
              return merged
            }
            return k
          })
          return updated
        })
      }
      toast.success(data?.message || 'Key blocked successfully')
    },
    onSettled: async (data: any, error: any, keyId: number) => {
      // After invalidation, ensure all blocked keys have correct is_expired
      await queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      
      // Wait a bit for queries to refetch, then correct any blocked keys
      setTimeout(() => {
        updateAllKeyLists(queryClient, (keys) => {
          const updated = keys.map((k) => {
            // If key is blocked (status = 2), ensure is_expired is false
            if (k.status === KEY_STATUS.BLOCKED && k.is_expired !== false) {
              const corrected = { ...k, is_expired: false, is_active: false }
              return corrected
            }
            return k
          })
          return updated
        })
      }, 500)
    },
  })

  const unblockKeyMutation = useMutation({
    mutationFn: (keyId: number) => unblockLicenseKey(keyId),
    onMutate: async (keyId: number) => {
      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) => {
        const updated = keys.map((k) => {
          if (k.id === keyId || String(k.id) === String(keyId)) {
            // Calculate is_expired based on expires_at
            const is_expired = k.expires_at ? new Date(k.expires_at) <= new Date() : false
            const newKey = { ...k, status: KEY_STATUS.ACTIVE, is_expired, is_active: !is_expired }
            return newKey
          }
          return k
        })
        return updated
      })

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to unblock key')
    },
    onSuccess: (data: any, keyId: number) => {
      // Update with server response data if available
      if (data?.key) {
        updateAllKeyLists(queryClient, (keys) => {
          const updated = keys.map((k) => {
            if (k.id === data.key.id || String(k.id) === String(data.key.id)) {
              const merged = { ...k, ...data.key }
              return merged
            }
            return k
          })
          return updated
        })
      }
      toast.success(data?.message || 'Key unblocked successfully')
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
    },
  })

  const resetKeyMutation = useMutation({
    mutationFn: (keyId: number) => resetLicenseKey(keyId),
    onMutate: async (keyId: number) => {
      await queryClient.cancelQueries({ queryKey: keyKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: keyKeys.lists() })

      updateAllKeyLists(queryClient, (keys) =>
        keys.map((k) => (k.id === keyId ? { ...k, device_count: 0 } : k))
      )

      return { previousQueries }
    },
    onError: (error: any, keyId: number, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(error?.message || 'Failed to reset key')
    },
    onSuccess: () => {
      toast.success('Key reset successfully')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
    },
  })

  const extendKeyMutation = useMutation({
    mutationFn: ({ keyId, hours }: { keyId: number; hours: number }) =>
      extendLicenseKey(keyId, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      toast.success('Key extended successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to extend key')
    },
  })

  const duplicateKeyMutation = useMutation({
    mutationFn: (keyId: number) => duplicateLicenseKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Key duplicated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to duplicate key')
    },
  })

  return {
    deleteKey: deleteKeyMutation.mutateAsync,
    pauseKey: pauseKeyMutation.mutateAsync,
    resumeKey: resumeKeyMutation.mutateAsync,
    blockKey: blockKeyMutation.mutateAsync,
    unblockKey: unblockKeyMutation.mutateAsync,
    resetKey: resetKeyMutation.mutateAsync,
    extendKey: extendKeyMutation.mutateAsync,
    duplicateKey: duplicateKeyMutation.mutateAsync,

    isDeleting: deleteKeyMutation.isPending,
    isPausing: pauseKeyMutation.isPending,
    isResuming: resumeKeyMutation.isPending,
    isBlocking: blockKeyMutation.isPending,
    isUnblocking: unblockKeyMutation.isPending,
    isResetting: resetKeyMutation.isPending,
    isExtending: extendKeyMutation.isPending,
    isDuplicating: duplicateKeyMutation.isPending,
  }
}
