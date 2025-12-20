import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
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

export async function updateProfile(data: ProfileDataType): Promise<ProfileResponseType> {

  const response = await api.put(API_ENDPOINTS.PROFILE, data)
  return response.data
}

export async function changePassword(data: ChangePasswordDataType): Promise<ChangePasswordResponseType> {

  const response = await api.post(API_ENDPOINTS.CHANGE_PASSWORD, data)
  return response.data
}

export async function uploadAvatar(file: File, cropData?: any): Promise<AvatarUploadResponseType> {
  const formData = new FormData()
  formData.append('avatar', file)

  if (cropData) {
    formData.append('crop_data', JSON.stringify(cropData))
  }

  const response = await api.post(API_ENDPOINTS.AVATAR, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export async function getUserActivity(
  page: number = 1, 
  perPage: number = 20
): Promise<UserActivityResponseType> {

  const response = await api.get(API_ENDPOINTS.PROFILE_ACTIVITY, {
    params: {
    page: page.toString(),
      per_page: perPage.toString()
    }
  })
  return response.data
}

export async function getUserActivityStats(): Promise<UserActivityStatsType> {

  const response = await api.get(API_ENDPOINTS.PROFILE_ACTIVITY_STATS)
  return response.data
}
