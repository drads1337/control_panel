import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { useAuthContext } from '@/app/providers/auth-provider'
import { toast } from 'sonner'

export interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
  is_system_role: boolean
  user_count: number
  created_at: string
  updated_at?: string
}

export interface Permission {
  [resource: string]: {
    id: number
    name: string
    description: string
    action: string
  }[]
}

export interface RolesResponse {
  success: boolean
  roles: Role[]
}

export interface PermissionsResponse {
  success: boolean
  permissions: Permission
}

export interface CreateRoleData {
  name: string
  description?: string
  permissions?: string[]
  parent_role_id?: number
}

export interface UpdateRoleData {
  name?: string
  description?: string
  permissions?: string[]
  parent_role_id?: number
}

export const rbacKeys = {
  all: ['rbac'] as const,
  roles: () => [...rbacKeys.all, 'roles'] as const,
  permissions: () => [...rbacKeys.all, 'permissions'] as const,
}

export function useRBACRoles() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: rbacKeys.roles(),
    queryFn: async (): Promise<Role[]> => {
      const response = await api.get<RolesResponse>('/api/rbac/roles')
      return response.data.roles || []
    },
    enabled: isAuthenticated,

    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }

      if (error?.response?.status === 429) {
        return false
      }

      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useRBACPermissions() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: rbacKeys.permissions(),
    queryFn: async (): Promise<Permission> => {
      const response = await api.get<PermissionsResponse>('/api/rbac/permissions')
      return response.data.permissions || {}
    },
    enabled: isAuthenticated,

    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }

      if (error?.response?.status === 429) {
        return false
      }

      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateRoleData): Promise<Role> => {
      const response = await api.post<{ success: boolean; role: Role }>('/api/rbac/roles', data)
      return response.data.role
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
      toast.success('Role created successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create role'
      toast.error(errorMessage)
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ roleId, data }: { roleId: number; data: UpdateRoleData }): Promise<Role> => {
      const response = await api.put<{ success: boolean; role: Role }>(`/api/rbac/roles/${roleId}`, data)
      return response.data.role
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
      toast.success('Role updated successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update role'
      toast.error(errorMessage)
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (roleId: number): Promise<void> => {
      await api.delete(`/api/rbac/roles/${roleId}`)
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
      toast.success('Role deleted successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete role'
      toast.error(errorMessage)
    },
  })
}

export function useRBAC() {
  const rolesQuery = useRBACRoles()
  const permissionsQuery = useRBACPermissions()
  const createRoleMutation = useCreateRole()
  const updateRoleMutation = useUpdateRole()
  const deleteRoleMutation = useDeleteRole()

  return {

    roles: rolesQuery.data || [],
    permissions: permissionsQuery.data || {},
    isLoading: rolesQuery.isLoading || permissionsQuery.isLoading,
    error: rolesQuery.error || permissionsQuery.error,

    createRole: createRoleMutation.mutateAsync,
    updateRole: updateRoleMutation.mutateAsync,
    deleteRole: deleteRoleMutation.mutateAsync,

    isCreating: createRoleMutation.isPending,
    isUpdating: updateRoleMutation.isPending,
    isDeleting: deleteRoleMutation.isPending,

    refetchRoles: rolesQuery.refetch,
    refetchPermissions: permissionsQuery.refetch,
  }
}
