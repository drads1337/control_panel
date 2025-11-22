import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { getApiUrl } from '@/lib/utils'

interface Role {
  id: number
  name: string
  description: string
  is_system_role: boolean
  created_at: string
  updated_at: string
}

interface Permission {
  id: number
  name: string
  description: string
  resource: string
  action: string
  resource_type?: string
  resource_id?: number
  product_id?: number
  scope: string
  created_at: string
}

interface UserRole {
  id: number
  user_id: number
  role_id: number
  assigned_at: string
  role: Role
}

interface UserPermission {
  id: number
  name: string
  description: string
  resource: string
  action: string
  resource_type?: string
  resource_id?: number
  product_id?: number
  scope: string
  created_at: string
}

interface RBACData {
  roles: Role[]
  permissions: Permission[]
  user_roles: UserRole[]
  user_permissions: string[] // API returns array of permission names (strings)
}

export function useRBACApi() {
  const { user, isAuthenticated } = useAuthContext()
  const [rbacData, setRbacData] = useState<RBACData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRBACData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const rolesResponse = await fetch(getApiUrl('/api/rbac/roles'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      if (!rolesResponse.ok) {
        throw new Error('Failed to fetch roles')
      }

      const rolesData = await rolesResponse.json()

      const permissionsResponse = await fetch(getApiUrl('/api/rbac/permissions'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      if (!permissionsResponse.ok) {
        throw new Error('Failed to fetch permissions')
      }

      const permissionsData = await permissionsResponse.json()

      const userRolesResponse = await fetch(getApiUrl(`/api/rbac/users/${user.id}/roles`), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      if (!userRolesResponse.ok) {
        throw new Error('Failed to fetch user roles')
      }

      const userRolesData = await userRolesResponse.json()

      const userPermissionsUrl = getApiUrl(`/api/rbac/users/${user.id}/permissions`)

      const userPermissionsResponse = await fetch(userPermissionsUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      let userPermissionsData: { user_permissions?: string[] } = { user_permissions: [] }

      if (!userPermissionsResponse.ok) {
        try {
          const errorData = await userPermissionsResponse.json()
          const errorMessage = errorData?.error || errorData?.message || ''


          if (errorMessage.includes('Static roles cannot manage RBAC')) {

            userPermissionsData = { user_permissions: [] }
          } else {
            throw new Error('Failed to fetch user permissions')
          }
        } catch (parseError) {

          throw new Error('Failed to fetch user permissions')
        }
      } else {
        userPermissionsData = await userPermissionsResponse.json()
      }

      setRbacData({
        roles: rolesData.roles || [],
        permissions: permissionsData.permissions || [],
        user_roles: userRolesData.user_roles || [],
        user_permissions: userPermissionsData.user_permissions || []
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch RBAC data'
      setError(errorMessage)

    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const createRole = useCallback(async (roleData: Partial<Role>) => {
    try {
      const response = await fetch(getApiUrl('/api/rbac/roles'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        },
        body: JSON.stringify(roleData)
      })

      if (!response.ok) {
        throw new Error('Failed to create role')
      }

      const result = await response.json()

      await fetchRBACData()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create role'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const updateRole = useCallback(async (roleId: number, roleData: Partial<Role>) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/roles/${roleId}`), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        },
        body: JSON.stringify(roleData)
      })

      if (!response.ok) {
        throw new Error('Failed to update role')
      }

      const result = await response.json()

      await fetchRBACData()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const deleteRole = useCallback(async (roleId: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/roles/${roleId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete role')
      }

      await fetchRBACData()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete role'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const assignRoleToUser = useCallback(async (userId: number, roleId: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/users/${userId}/roles`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        },
        body: JSON.stringify({ role_id: roleId })
      })

      if (!response.ok) {
        throw new Error('Failed to assign role to user')
      }

      const result = await response.json()

      await fetchRBACData()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign role to user'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const removeRoleFromUser = useCallback(async (userId: number, roleId: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/users/${userId}/roles/${roleId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to remove role from user')
      }

      await fetchRBACData()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove role from user'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const assignPermissionToRole = useCallback(async (roleId: number, permissionId: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/roles/${roleId}/permissions`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'product/json'
        },
        body: JSON.stringify({ permission_id: permissionId })
      })

      if (!response.ok) {
        throw new Error('Failed to assign permission to role')
      }

      const result = await response.json()

      await fetchRBACData()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign permission to role'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  const removePermissionFromRole = useCallback(async (roleId: number, permissionId: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/rbac/roles/${roleId}/permissions/${permissionId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'Content-Type': 'product/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to remove permission from role')
      }

      await fetchRBACData()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove permission from role'
      setError(errorMessage)
      throw err
    }
  }, [fetchRBACData])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRBACData()
    }
  }, [isAuthenticated, user, fetchRBACData])

  return {
    rbacData,
    loading,
    error,
    fetchRBACData,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    removeRoleFromUser,
    assignPermissionToRole,
    removePermissionFromRole
  }
}
