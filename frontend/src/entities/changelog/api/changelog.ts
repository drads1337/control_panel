import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ChangelogResponse, ChangelogEntry, CreateChangelogData } from '@/entities/changelog';
import type {
  ChangelogResponse as ChangelogResponseType,
  ChangelogEntry as ChangelogEntryType,
  CreateChangelogData as CreateChangelogDataType
} from '../model/types'

export async function getGameChangelog(gameId: number): Promise<ChangelogResponseType> {

  const response = await api.get(`${API_ENDPOINTS.CHANGELOG_GAMES}/${gameId}/changelog`, {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  })

  return response.data
}

export async function getChangelogEntry(entryId: number): Promise<{
  success: boolean
  entry: ChangelogEntryType
}> {

  const response = await api.get(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`, {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  })

  return response.data
}

export async function createChangelogEntry(gameId: number, data: CreateChangelogDataType): Promise<{
  success: boolean
  message: string
  entry: ChangelogEntryType
}> {

  const response = await api.post(`${API_ENDPOINTS.CHANGELOG_GAMES}/${gameId}/changelog`, data)
  return response.data
}

export async function updateChangelogEntry(entryId: number, data: Partial<CreateChangelogDataType>): Promise<{
  success: boolean
  message: string
  entry: ChangelogEntryType
}> {

  const response = await api.put(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`, data)
  return response.data
}

export async function deleteChangelogEntry(entryId: number): Promise<{
  success: boolean
  message: string
}> {

  const response = await api.delete(`${API_ENDPOINTS.CHANGELOG_CHANGELOG}/${entryId}`)
  return response.data
}
