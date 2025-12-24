import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { apiCall } from '@/shared/api/api-wrapper'
import type { ChangelogResponse, ChangelogEntry, CreateChangelogData } from '@/entities/changelog';
import type {
  ChangelogResponse as ChangelogResponseType,
  ChangelogEntry as ChangelogEntryType,
  CreateChangelogData as CreateChangelogDataType
} from '../model/types'

export async function getProductChangelog(productId: number): Promise<ChangelogResponseType> {
  return apiCall(() => api.get(`${API_ENDPOINTS.CHANGELOG_PRODUCTS}/${productId}/changelog`, {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  }))
}

export async function getChangelogEntry(entryId: number): Promise<{
  success: boolean
  entry: ChangelogEntryType
}> {
  return apiCall(() => api.get(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`, {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  }))
}

export async function createChangelogEntry(productId: number, data: CreateChangelogDataType): Promise<{
  success: boolean
  message: string
  entry: ChangelogEntryType
}> {
  return apiCall(() => api.post(`${API_ENDPOINTS.CHANGELOG_PRODUCTS}/${productId}/changelog`, data))
}

export async function updateChangelogEntry(entryId: number, data: Partial<CreateChangelogDataType>): Promise<{
  success: boolean
  message: string
  entry: ChangelogEntryType
}> {
  return apiCall(() => api.put(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`, data))
}

export async function deleteChangelogEntry(entryId: number): Promise<{
  success: boolean
  message: string
}> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`))
}

export async function getAgentChangelog(agentId: number): Promise<ChangelogResponseType> {
  return apiCall(() => api.get(`/api/changelog/agents/${agentId}/changelog`, {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  }))
}

export async function createAgentChangelogEntry(agentId: number, data: CreateChangelogDataType): Promise<{
  success: boolean
  message: string
  entry: ChangelogEntryType
}> {
  return apiCall(() => api.post(`/api/changelog/agents/${agentId}/changelog`, data))
}
