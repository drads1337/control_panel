import React from 'react'
import { getProjects, createProject, updateProject, deleteProject } from '@/entities/project'
import type { Project, CreateProjectData, ProjectsResponse } from '@/entities/project/model/types'
import { usePaginatedResource, useMutationWithCache } from '@/shared/hooks'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: any) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

interface UseProjectsParams {
  page?: number
  per_page?: number
  search?: string
}

interface UseProjectsReturn {
  projects: Project[]
  loading: boolean
  error: string | null
  total: number
  pages: number
  currentPage: number
  perPage: number
  pagination: {
    currentPage: number
    pages: number
    total: number
    perPage: number
  }

  createProject: (data: CreateProjectData) => Promise<Project>
  updateProject: (id: number, data: Partial<CreateProjectData> & { status?: string; subscription_days?: number }) => Promise<Project>
  deleteProject: (id: number) => Promise<void>

  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setSearch: (search: string) => void

  refetch: () => void
}

export function useProjectsQuery(initialParams: UseProjectsParams = {}): UseProjectsReturn {
  const {
    items: projects,
    loading,
    error,
    pagination,
    setPage,
    setPerPage,
    setParams,
    refetch,
  } = usePaginatedResource<ProjectsResponse, Project, UseProjectsParams>({
    queryKeyFactory: projectKeys,
    queryFn: (params) => getProjects(params.page || 1, params.per_page || 20, params.search),
    itemsField: 'projects',
    initialParams,
    queryOptions: {
      staleTime: 2 * 60 * 1000,
    },
  })

  const createProjectMutation = useMutationWithCache({
    mutationFn: (data: CreateProjectData) => createProject(data),
    invalidateQueries: [projectKeys.lists()],
    successMessage: 'Project created successfully',
    errorMessage: 'Failed to create project',
  })

  const updateProjectMutation = useMutationWithCache({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateProjectData> & { status?: string; subscription_days?: number } }) => 
      updateProject(id, data),
    invalidateQueries: [projectKeys.lists()],
    successMessage: 'Project updated successfully',
    errorMessage: 'Failed to update project',
  })

  const deleteProjectMutation = useMutationWithCache({
    mutationFn: (id: number) => deleteProject(id),
    invalidateQueries: [projectKeys.lists()],
    successMessage: 'Project deleted successfully',
    errorMessage: 'Failed to delete project',
  })

  const setSearch = React.useCallback((search: string) => {
    setParams((prev) => ({ ...prev, search, page: 1 }))
  }, [setParams])

  return {
    projects,
    loading,
    error,
    total: pagination.total,
    pages: pagination.pages,
    currentPage: pagination.currentPage,
    perPage: pagination.perPage,
    pagination,

    createProject: createProjectMutation.mutateAsync,
    updateProject: (id: number, data: Partial<CreateProjectData> & { status?: string; subscription_days?: number }) => 
      updateProjectMutation.mutateAsync({ id, data }),
    deleteProject: deleteProjectMutation.mutateAsync,

    setPage,
    setPerPage,
    setSearch,

    refetch,
  }
}

