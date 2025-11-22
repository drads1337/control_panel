import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { getErrorMessage, isAxiosError } from '@/lib/error-utils'
import type { ProjectsResponse, CreateProjectData, Project } from '@/entities/project';
import type {
  ProjectsResponse as ProjectTypesResponse,
  CreateProjectData as ProjectCreateData,
  Project as ProjectType
} from '../model/types'

export async function getProjects(page: number = 1, perPage: number = 20, search?: string): Promise<ProjectTypesResponse> {

  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  }

  if (search) {
    params.search = search
  }

  const response = await api.get(API_ENDPOINTS.PROJECTS, { params })

  return response.data
}

export async function createProject(data: ProjectCreateData): Promise<ProjectType> {
  try {

    const response = await api.post(API_ENDPOINTS.PROJECTS, data)
    return response.data
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}

export async function updateProject(projectId: number, data: Partial<ProjectCreateData> & { status?: string; subscription_days?: number }): Promise<ProjectType> {
  try {

    const response = await api.put(`${API_ENDPOINTS.PROJECTS}/${projectId}`, data)

    return response.data
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}

export async function getProject(projectId: number): Promise<ProjectType> {
  try {

    const response = await api.get(`${API_ENDPOINTS.PROJECTS}/${projectId}`)

    return response.data
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}

export async function deleteProject(projectId: number): Promise<void> {
  try {

    await api.delete(`${API_ENDPOINTS.PROJECTS}/${projectId}`)
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}
