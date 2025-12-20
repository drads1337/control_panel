import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import { apiCall, apiCallWithErrorData } from '@/lib/api/api-wrapper'
import { getErrorStatus, isAxiosError } from '@/lib/utils/error-utils'
import type { InviteCode, CreateInviteCodeData, ReferralCode, CreateProjectInviteCodeData, ProjectInviteCode } from '@/entities/user';
import type { Project } from '@/entities/project';
import type {
  InviteCode as InviteCodeType,
  CreateInviteCodeData as CreateInviteCodeDataType,
  ReferralCode as ReferralCodeType,
  CreateProjectInviteCodeData as CreateProjectInviteCodeDataType,
  ProjectInviteCode as ProjectInviteCodeType
} from '../model/types'

export async function generateInviteCode(data: CreateInviteCodeDataType): Promise<InviteCodeType> {
  return apiCallWithErrorData(() => api.post(API_ENDPOINTS.USERS_REFCODES, {
    code: data.code || '',
    expires_in_days: data.expires_in_days || 7,
    product_ids: data.product_ids || [],
    rbac_role_ids: data.rbac_role_ids || [],
  }))
}

export async function getInviteCodes(): Promise<InviteCodeType[]> {

  const response = await api.get(API_ENDPOINTS.USERS_REFCODES)
  return response.data
}

export async function getLatestInviteCode(): Promise<{ invite_code: InviteCodeType }> {

  const response = await api.get(API_ENDPOINTS.USERS_REFCODES)
  const codes = response.data

  if (codes.length === 0) {
    throw new Error('No referral codes found')
  }

  const latestCode = codes
    .filter((code: InviteCode) => !code.used)
    .sort((a: InviteCode, b: InviteCode) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

  return { invite_code: latestCode }
}

export async function updateInviteCodeDuration(durationDays: number): Promise<{ msg: string }> {

  return { msg: 'Duration update not available for referral codes' }
}

export async function generateProjectInviteCode(data: CreateProjectInviteCodeDataType): Promise<ProjectInviteCodeType> {
  return apiCall(() => api.post(API_ENDPOINTS.PROJECT_CODES, {
    expires_in_days: data.expires_in_days || 7
  }), {
    onError: async (error) => {
      const status = getErrorStatus(error)
      
      if (status === 403 && isAxiosError(error)) {
        const errorData = error.response?.data
        if (errorData && typeof errorData === 'object') {
          const errorCode = (errorData as { error?: string }).error
          if (errorCode === 'CSRF_ERROR' || (typeof errorCode === 'string' && errorCode.includes('CSRF'))) {
            const { clearCsrfToken } = await import('@/lib/csrf')
            clearCsrfToken()
            throw new Error('CSRF token validation failed. Please refresh the page and try again.')
          }
        }
      }
    }
  })
}

export async function getProjectInviteCodes(): Promise<ProjectInviteCodeType[]> {
  return apiCall(() => api.get(API_ENDPOINTS.PROJECT_CODES), {
    onError: (error) => {
      const status = getErrorStatus(error)
      
      if (status === 400 && isAxiosError(error)) {
        const errorData = error.response?.data
        if (errorData && typeof errorData === 'object') {
          const errorMsg = (errorData as { error?: string }).error
          throw new Error(errorMsg || 'User must be assigned to a project')
        }
      }
    }
  })
}

export async function getLatestProjectInviteCode(): Promise<{ invite_code: ProjectInviteCodeType | null }> {
  try {
    return await apiCall(() => api.get(API_ENDPOINTS.PROJECT_CODES_LATEST), {
      onError: (error) => {
        const status = getErrorStatus(error)
        
        if (status === 400 && isAxiosError(error)) {
          const errorData = error.response?.data
          if (errorData && typeof errorData === 'object') {
            const errorMsg = (errorData as { error?: string }).error
            throw new Error(errorMsg || 'User must be assigned to a project')
          }
        }
      }
    })
  } catch (error) {
    const status = getErrorStatus(error)
    if (status === 404) {
      return { invite_code: null }
    }
    throw error
  }
}

export async function deleteUnusedProjectInviteCodes(): Promise<{ message: string; deleted_count: number }> {

  const response = await api.delete(API_ENDPOINTS.PROJECT_CODES_DELETE_UNUSED)
  return response.data
}

export async function deleteUnusedInviteCodes(): Promise<{ msg: string; deleted_count: number }> {

  const response = await api.delete(API_ENDPOINTS.USERS_REFCODES_DELETE_UNUSED)
  return response.data
}

export async function getReferralCodes(): Promise<ReferralCodeType[]> {

  const response = await api.get(API_ENDPOINTS.USERS_REFCODES)
  return response.data
}
