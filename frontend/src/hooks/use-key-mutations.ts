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

      updateAllKeyLists(queryClient, (keys) =>
        keys.map((k) => (k.id === keyId ? { ...k, status: KEY_STATUS.BLOCKED } : k))
      )

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
    onSuccess: () => {
      toast.success('Key blocked successfully')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
    },
  })

  const unblockKeyMutation = useMutation({
    mutationFn: (keyId: number) => unblockLicenseKey(keyId),
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
      toast.error(error?.message || 'Failed to unblock key')
    },
    onSuccess: () => {
      toast.success('Key unblocked successfully')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
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
