import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import { apiCallWithErrorData } from '@/lib/api/api-wrapper'
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
  return apiCallWithErrorData(() => api.post(API_ENDPOINTS.PROJECTS, data))
}

export async function updateProject(projectId: number, data: Partial<ProjectCreateData> & { status?: string; subscription_days?: number }): Promise<ProjectType> {
  return apiCallWithErrorData(() => api.put(`${API_ENDPOINTS.PROJECTS}/${projectId}`, data))
}

export async function getProject(projectId: number): Promise<ProjectType> {
  return apiCallWithErrorData(() => api.get(`${API_ENDPOINTS.PROJECTS}/${projectId}`))
}

export async function deleteProject(projectId: number): Promise<void> {
  return apiCallWithErrorData(() => api.delete(`${API_ENDPOINTS.PROJECTS}/${projectId}`))
}
