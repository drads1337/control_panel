import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser } from '@/entities/user'
import type { User, CreateUserData, UpdateUserData, UsersResponse } from '@/entities/user/model/types'
import { usePaginatedResource } from '@/hooks/use-paginated-resource'
import { useMutationWithCache } from '@/hooks/use-mutation-helpers'

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: any) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
}

interface UseUsersParams {
  page?: number
  per_page?: number
  role?: string
  roles?: string[]
  search?: string
  project_id?: number
}

interface UseUsersReturn {
  users: User[]
  loading: boolean
  error: string | null
  total: number
  pages: number
  currentPage: number
  perPage: number
  stats: {
    total: number
    active: number
    blocked: number
    admins: number
  } | null
  statsLoading: boolean

  createUser: (data: CreateUserData) => Promise<User>
  updateUser: (id: number, data: UpdateUserData) => Promise<User>
  deleteUser: (id: number) => Promise<void>

  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setSearch: (search: string) => void
  setRole: (role: string | undefined) => void
  setRoles: (roles: string[] | undefined) => void
  setProjectId: (projectId: number | undefined) => void

  refetch: () => void
  refetchStats: () => void
}

export function useUsersQuery(initialParams: UseUsersParams = {}): UseUsersReturn {
  const {
    items: users,
    loading,
    error,
    pagination,
    data: usersData,
    setPage,
    setPerPage,
    setParams,
    refetch,
  } = usePaginatedResource<UsersResponse, User, UseUsersParams>({
    queryKeyFactory: userKeys,
    queryFn: (params) => getUsers(params),
    itemsField: 'users',
    initialParams,
    queryOptions: {
      staleTime: 2 * 60 * 1000,
    },
    requireAuth: false,
  })

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: userKeys.stats(),
    queryFn: async () => {
      return {
        total: usersData?.total || 0,
        active: usersData?.users?.filter(u => !u.expires_at || new Date(u.expires_at) > new Date()).length || 0,
        blocked: usersData?.users?.filter(u => u.expires_at && new Date(u.expires_at) <= new Date()).length || 0,
        admins: usersData?.users?.filter(u => u.roles?.includes('admin')).length || 0,
      }
    },
    enabled: !!usersData,
    staleTime: 5 * 60 * 1000,
  })

  const createUserMutation = useMutationWithCache({
    mutationFn: createUser,
    invalidateQueries: [userKeys.lists(), userKeys.stats()],
    successMessage: 'User created successfully',
    errorMessage: 'Failed to create user',
  })

  const updateUserMutation = useMutationWithCache({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) => 
      updateUser(id, data),
    invalidateQueries: [userKeys.lists(), userKeys.stats()],
    successMessage: 'User updated successfully',
    errorMessage: 'Failed to update user',
  })

  const deleteUserMutation = useMutationWithCache({
    mutationFn: deleteUser,
    invalidateQueries: [userKeys.lists(), userKeys.stats()],
    successMessage: 'User deleted successfully',
    errorMessage: 'Failed to delete user',
  })

  const setSearch = React.useCallback((search: string) => {
    setParams((prev) => ({ ...prev, search, page: 1 }))
  }, [setParams])

  const setRole = React.useCallback((role: string | undefined) => {
    setParams((prev) => ({ ...prev, role, page: 1 }))
  }, [setParams])

  const setRoles = React.useCallback((roles: string[] | undefined) => {
    setParams((prev) => ({ ...prev, roles, page: 1 }))
  }, [setParams])

  const setProjectId = React.useCallback((projectId: number | undefined) => {
    setParams((prev) => ({ ...prev, project_id: projectId, page: 1 }))
  }, [setParams])

  return {
    users,
    loading,
    error,
    total: pagination.total,
    pages: pagination.pages,
    currentPage: pagination.currentPage,
    perPage: pagination.perPage,
    stats: statsData || null,
    statsLoading,

    createUser: createUserMutation.mutateAsync,
    updateUser: (id: number, data: UpdateUserData) => 
      updateUserMutation.mutateAsync({ id, data }),
    deleteUser: deleteUserMutation.mutateAsync,

    setPage,
    setPerPage,
    setSearch,
    setRole,
    setRoles,
    setProjectId,

    refetch,
    refetchStats,
  }
}

