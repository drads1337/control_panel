import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ProjectSettings, UpdateSettingsData, UpdateKeysData } from '@/entities/settings';
import type {
  ProjectSettings as ProjectSettingsType,
  UpdateSettingsData as UpdateSettingsDataType,
  UpdateKeysData as UpdateKeysDataType
} from '../model/types'

export async function getProjectSettings(): Promise<ProjectSettingsType> {

  const response = await api.get(API_ENDPOINTS.SETTINGS)
  return response.data
}

export async function updateProjectSettings(data: UpdateSettingsDataType): Promise<void> {

  await api.put(API_ENDPOINTS.SETTINGS, data)

}

export async function regenerateKeys(action: 'aes' | 'rsa' | 'all' = 'all'): Promise<ProjectSettings['encryption_keys']> {

  const response = await api.post(API_ENDPOINTS.SETTINGS_KEYS, { action })
  return response.data.keys
}

export async function updateKeys(data: UpdateKeysDataType): Promise<void> {

  await api.put(API_ENDPOINTS.SETTINGS_KEYS, data)
}

export async function regenerateMasterKey(): Promise<{old_key: string, new_key: string, message: string, warning: string}> {

  const response = await api.post(API_ENDPOINTS.SETTINGS_REGENERATE_MASTER_KEY)
  return response.data
}
