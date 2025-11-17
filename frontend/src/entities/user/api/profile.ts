import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ProfileData, ProfileResponse, ChangePasswordData, ChangePasswordResponse, AvatarUploadResponse, UserActivity, UserActivityResponse, UserActivityStats, User } from '@/entities/user';
import type {
  ProfileData as ProfileDataType,
  ProfileResponse as ProfileResponseType,
  ChangePasswordData as ChangePasswordDataType,
  ChangePasswordResponse as ChangePasswordResponseType,
  AvatarUploadResponse as AvatarUploadResponseType,
  UserActivity as UserActivityType,
  UserActivityResponse as UserActivityResponseType,
  UserActivityStats as UserActivityStatsType
} from '../model/types'

// Profile API functions
// All functions use centralized axios instance with CSRF protection
export async function updateProfile(data: ProfileDataType): Promise<ProfileResponseType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.put(API_ENDPOINTS.PROFILE, data)
  return response.data
}

export async function changePassword(data: ChangePasswordDataType): Promise<ChangePasswordResponseType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.post(API_ENDPOINTS.CHANGE_PASSWORD, data)
  return response.data
}

export async function uploadAvatar(file: File, cropData?: any): Promise<AvatarUploadResponseType> {
  const formData = new FormData()
  formData.append('avatar', file)
  
  if (cropData) {
    formData.append('crop_data', JSON.stringify(cropData))
  }
  
  // CSRF token and credentials are automatically handled by axios interceptors
  // axios automatically sets Content-Type with boundary for FormData
  const response = await api.post(API_ENDPOINTS.AVATAR, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

// User Activity API function
export async function getUserActivity(
  page: number = 1, 
  perPage: number = 20
): Promise<UserActivityResponseType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(API_ENDPOINTS.PROFILE_ACTIVITY, {
    params: {
    page: page.toString(),
      per_page: perPage.toString()
    }
  })
  return response.data
}

// User Activity Stats API function
export async function getUserActivityStats(): Promise<UserActivityStatsType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(API_ENDPOINTS.PROFILE_ACTIVITY_STATS)
  return response.data
}
