import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import {
  getProjectSettings,
  updateProjectSettings,
  regenerateKeys,
  updateKeys,
  regenerateMasterKey,
} from '@/entities/settings'
import type { ProjectSettings, UpdateSettingsData, UpdateKeysData } from '@/entities/settings'
import { toast } from 'sonner'

// Cache keys
export const settingsKeys = {
  all: ['settings'] as const,
  project: () => [...settingsKeys.all, 'project'] as const,
}

export interface UseSettingsQueryReturn {
  settings: ProjectSettings | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  
  // Actions
  saveSettings: (data: UpdateSettingsData) => Promise<void>
  regenerateKeys: (action?: 'aes' | 'rsa' | 'all') => Promise<void>
  updateKeys: (data: UpdateKeysData) => Promise<void>
  regenerateMasterKey: () => Promise<{old_key: string, new_key: string, message: string, warning: string}>
  refetch: () => void
  clearError: () => void
}

export function useSettingsQuery(): UseSettingsQueryReturn {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthContext()
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Settings query
  const {
    data: settings,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: settingsKeys.project(),
    queryFn: getProjectSettings,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: updateProjectSettings,
    onMutate: () => {
      setIsSaving(true)
      setError(null)
    },
    onSuccess: async (_, variables) => {
      // Optimistically update the cache
      queryClient.setQueryData<ProjectSettings>(settingsKeys.project(), (old) => {
        if (!old) return old
        
        // Deep merge the data
        const updated = { ...old }
        Object.keys(variables).forEach(key => {
          const k = key as keyof UpdateSettingsData
          const incoming = variables[k]
          if (incoming === undefined) return
          const current = updated[k as keyof ProjectSettings] as any
          if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
            updated[k as keyof ProjectSettings] = {
              ...(current && typeof current === 'object' ? current : {}),
              ...incoming
            } as any
          } else {
            updated[k as keyof ProjectSettings] = incoming as any
          }
        })
        return updated
      })
      
      toast.success('Settings saved successfully')
    },
    onError: (err: any) => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      setError(errorMessage)
      toast.error(errorMessage)
    },
    onSettled: () => {
      setIsSaving(false)
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: settingsKeys.project() })
    },
  })

  // Regenerate keys mutation
  const regenerateKeysMutation = useMutation({
    mutationFn: regenerateKeys,
    onMutate: () => {
      setIsSaving(true)
      setError(null)
    },
    onSuccess: async (newKeys) => {
      // Update cache with new keys
      queryClient.setQueryData<ProjectSettings>(settingsKeys.project(), (old) => {
        if (!old) return old
        return { ...old, encryption_keys: newKeys }
      })
      toast.success('Ключи успешно перегенерированы')
    },
    onError: (err: any) => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate keys'
      setError(errorMessage)
      toast.error(errorMessage)
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  // Update keys mutation
  const updateKeysMutation = useMutation({
    mutationFn: updateKeys,
    onMutate: () => {
      setIsSaving(true)
      setError(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.project() })
      toast.success('Ключи обновлены')
    },
    onError: (err: any) => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update keys'
      setError(errorMessage)
      toast.error(errorMessage)
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  // Regenerate master key mutation
  const regenerateMasterKeyMutation = useMutation({
    mutationFn: regenerateMasterKey,
    onMutate: () => {
      setIsSaving(true)
      setError(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.project() })
      toast.success('Мастер-ключ успешно перегенерирован')
    },
    onError: (err: any) => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate master key'
      setError(errorMessage)
      toast.error(errorMessage)
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return {
    settings: settings || null,
    isLoading,
    isSaving,
    error: error || queryError?.message || null,
    
    saveSettings: saveSettingsMutation.mutateAsync,
    regenerateKeys: async (action?: 'aes' | 'rsa' | 'all'): Promise<void> => {
      await regenerateKeysMutation.mutateAsync(action)
    },
    updateKeys: updateKeysMutation.mutateAsync,
    regenerateMasterKey: regenerateMasterKeyMutation.mutateAsync,
    refetch,
    clearError,
  }
}

