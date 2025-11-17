import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ProjectsResponse, CreateProjectData, Project } from '@/entities/project';
import type {
  ProjectsResponse as ProjectTypesResponse,
  CreateProjectData as ProjectCreateData,
  Project as ProjectType
} from '../model/types'

// Project API functions
// All functions use centralized axios instance with CSRF protection
export async function getProjects(page: number = 1, perPage: number = 20, search?: string): Promise<ProjectTypesResponse> {
  console.log('[API] getProjects - params:', { page, perPage, search })
  
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  }
  
  if (search) {
    params.search = search
  }
  
  // CSRF token is automatically added by axios interceptor
  const response = await api.get(API_ENDPOINTS.PROJECTS, { params })
  
  console.log('[API] getProjects - Response data:', {
    hasProjects: !!response.data.projects,
    projectsLength: response.data.projects?.length || 0,
    total: response.data.total,
    pages: response.data.pages,
    keys: Object.keys(response.data)
  })
  
  return response.data
}

export async function createProject(data: ProjectCreateData): Promise<ProjectType> {
  try {
    // CSRF token is automatically added by axios interceptor
    const response = await api.post(API_ENDPOINTS.PROJECTS, data)
    return response.data
  } catch (err: any) {
    console.error('📁 [createProject] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to create project')
  }
}

export async function updateProject(projectId: number, data: Partial<ProjectCreateData> & { status?: string; subscription_days?: number }): Promise<ProjectType> {
  try {
    console.log('[API] updateProject - projectId:', projectId, 'data:', data)
    
    // CSRF token is automatically added by axios interceptor
    const response = await api.put(`${API_ENDPOINTS.PROJECTS}/${projectId}`, data)
    
    console.log('[API] updateProject - Success response:', response.data)
    return response.data
  } catch (err: any) {
    console.error('📁 [updateProject] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to update project')
  }
}

export async function getProject(projectId: number): Promise<ProjectType> {
  try {
    console.log('[API] getProject - projectId:', projectId)
    
    // CSRF token is automatically added by axios interceptor
    const response = await api.get(`${API_ENDPOINTS.PROJECTS}/${projectId}`)
    
    console.log('[API] getProject - Response data:', response.data)
    return response.data
  } catch (err: any) {
    console.error('📁 [getProject] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to fetch project')
  }
}

export async function deleteProject(projectId: number): Promise<void> {
  try {
    // CSRF token is automatically added by axios interceptor
    await api.delete(`${API_ENDPOINTS.PROJECTS}/${projectId}`)
  } catch (err: any) {
    console.error('📁 [deleteProject] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to delete project')
  }
}
