import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
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

  try {

    const response = await api.post(API_ENDPOINTS.USERS_REFCODES, {
      code: data.code || '',
      expires_in_days: data.expires_in_days || 7,
      game_ids: data.game_ids || [],
      rbac_role_ids: data.rbac_role_ids || [],
    })

    return response.data
  } catch (error: any) {

    const errorData = error.response?.data || {}
    throw new Error(errorData.error || error.message || 'Failed to generate referral code')
  }
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

  try {

    const response = await api.post(API_ENDPOINTS.PROJECT_CODES, {
      expires_in_days: data.expires_in_days || 7
    })

    return response.data
  } catch (error: any) {

    const errorData = error.response?.data || {}

    if (error.response?.status === 403 && (errorData.error === 'CSRF_ERROR' || errorData.error?.includes('CSRF'))) {
      const { clearCsrfToken } = await import('@/lib/csrf')
      clearCsrfToken()
      throw new Error('CSRF token validation failed. Please refresh the page and try again.')
    }

    throw new Error(errorData.error || error.message || 'Failed to generate project invite code')
  }
}

export async function getProjectInviteCodes(): Promise<ProjectInviteCodeType[]> {
  try {

    const response = await api.get(API_ENDPOINTS.PROJECT_CODES)
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || {}

    if (error.response?.status === 400) {
      throw new Error(errorData.error || 'User must be assigned to a project')
    }

    throw new Error(errorData.error || error.message || 'Failed to fetch project invite codes')
  }
}

export async function getLatestProjectInviteCode(): Promise<{ invite_code: ProjectInviteCodeType | null }> {
  try {

    const response = await api.get(API_ENDPOINTS.PROJECT_CODES_LATEST)
    return response.data
  } catch (error: any) {

    if (error.response?.status === 404) {
      return { invite_code: null }
    }

    const errorData = error.response?.data || {}

    if (error.response?.status === 400) {
      throw new Error(errorData.error || 'User must be assigned to a project')
    }

    throw new Error(errorData.error || error.message || 'Failed to fetch latest project invite code')
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
