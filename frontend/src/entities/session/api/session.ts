import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { SessionsResponse, SessionStats, SessionDetails, Session } from '@/entities/session';
import type {
  SessionsResponse as SessionTypesResponse,
  SessionStats as SessionStatsType,
  SessionDetails as SessionDetailsType
} from '../model/types'

// Session API functions
export async function getSessions(
  page: number = 1, 
  perPage: number = 20, 
  userId?: number
): Promise<SessionTypesResponse> {
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  }
  
  if (userId) {
    params.user_id = userId.toString()
  }
  
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.get(API_ENDPOINTS.SESSIONS, { params })
  return response.data
}

export async function getSessionStats(): Promise<SessionStatsType> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.get(API_ENDPOINTS.SESSIONS_STATS)
  return response.data
}

export async function getSessionDetails(userId: number): Promise<SessionDetailsType> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.get(`${API_ENDPOINTS.SESSIONS}/${userId}/details`)
  return response.data
}

export async function terminateSession(userId: number): Promise<{ message: string; user_id: number }> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.post(`${API_ENDPOINTS.SESSIONS}/${userId}/terminate`)
  return response.data
}

export async function bulkTerminateSessions(userIds: number[]): Promise<{ message: string; terminated_count: number }> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.post(API_ENDPOINTS.SESSIONS_BULK_TERMINATE, { user_ids: userIds })
  return response.data
}

export async function getRealtimeSessions(): Promise<{ sessions: any[]; count: number; timestamp: string }> {
  // CSRF token and credentials are automatically handled by axios interceptors in base.ts
  const response = await api.get(API_ENDPOINTS.SESSIONS_REALTIME)
  return response.data
}
