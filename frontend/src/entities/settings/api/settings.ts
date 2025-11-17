import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ProjectSettings, UpdateSettingsData, UpdateKeysData } from '@/entities/settings';
import type {
  ProjectSettings as ProjectSettingsType,
  UpdateSettingsData as UpdateSettingsDataType,
  UpdateKeysData as UpdateKeysDataType
} from '../model/types'

// Settings API functions
export async function getProjectSettings(): Promise<ProjectSettingsType> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.get(API_ENDPOINTS.SETTINGS)
  return response.data
}

export async function updateProjectSettings(data: UpdateSettingsDataType): Promise<void> {
  console.log('Sending to API:', data)
  
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  await api.put(API_ENDPOINTS.SETTINGS, data)
  
  console.log('Settings updated successfully')
}

export async function regenerateKeys(action: 'aes' | 'rsa' | 'all' = 'all'): Promise<ProjectSettings['encryption_keys']> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.post(API_ENDPOINTS.SETTINGS_KEYS, { action })
  return response.data.keys
}

export async function updateKeys(data: UpdateKeysDataType): Promise<void> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  await api.put(API_ENDPOINTS.SETTINGS_KEYS, data)
}

export async function regenerateMasterKey(): Promise<{old_key: string, new_key: string, message: string, warning: string}> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.post(API_ENDPOINTS.SETTINGS_REGENERATE_MASTER_KEY)
  return response.data
}
