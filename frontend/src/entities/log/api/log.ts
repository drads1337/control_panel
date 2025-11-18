import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { LogsResponse, LogStats, ConnectionLogsResponse, ConnectionLogStats, Log } from '@/entities/log';
import type {
  LogsResponse as LogTypesResponse,
  LogStats as LogStatsType,
  ConnectionLogsResponse as ConnectionLogTypesResponse,
  ConnectionLogStats as ConnectionLogStatsType
} from '../model/types'

export async function getLogs(
  page: number = 1,
  perPage: number = 50,
  action?: string,
  userId?: number,
  dateFrom?: string,
  dateTo?: string,
  ip?: string,
  projectId?: number | string
): Promise<LogTypesResponse> {
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  }

  if (action && action.trim() !== '') params.action = action
  if (userId) params.user_id = userId.toString()
  if (dateFrom && dateFrom.trim() !== '') params.date_from = dateFrom
  if (dateTo && dateTo.trim() !== '') params.date_to = dateTo
  if (ip && ip.trim() !== '') params.ip = ip
  if (projectId && projectId !== 'all') params.project_id = projectId.toString()

  const response = await api.get(API_ENDPOINTS.LOGS, { params })
  return response.data
}

export async function getLogStats(): Promise<LogStatsType> {

  const response = await api.get(API_ENDPOINTS.LOGS_STATS)
  return response.data
}

export async function getConnectionLogs(
  page: number = 1,
  perPage: number = 50,
  status?: string,
  userId?: number,
  dateFrom?: string,
  dateTo?: string,
  ip?: string,
  game?: string
): Promise<ConnectionLogTypesResponse> {
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  }

  if (status) params.status = status
  if (userId) params.user_id = userId.toString()
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  if (ip) params.ip = ip
  if (game) params.game = game

  const response = await api.get(API_ENDPOINTS.LOGS_CONNECTS, { params })
  return response.data
}

export async function getConnectionLogStats(): Promise<ConnectionLogStatsType> {

  const response = await api.get(API_ENDPOINTS.LOGS_CONNECTS_STATS)
  return response.data
}

export async function searchLogs(
  searchTerm: string,
  page: number = 1,
  perPage: number = 20
): Promise<LogTypesResponse> {
  const params: Record<string, string> = {
    q: searchTerm,
    page: page.toString(),
    per_page: perPage.toString(),
  }

  const response = await api.get(API_ENDPOINTS.LOGS_SEARCH, { params })
  return response.data
}

export async function getRealtimeLogs(): Promise<{ logs: any[]; count: number; timestamp: string }> {

  const response = await api.get(API_ENDPOINTS.LOGS_REALTIME)
  return response.data
}

export async function exportLogs(
  action?: string,
  userId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<Blob> {
  const params: Record<string, string> = {}

  if (action && action.trim() !== '') params.action = action
  if (userId) params.user_id = userId.toString()
  if (dateFrom && dateFrom.trim() !== '') params.date_from = dateFrom
  if (dateTo && dateTo.trim() !== '') params.date_to = dateTo

  const response = await api.get(API_ENDPOINTS.LOGS_EXPORT, { 
    params,
    responseType: 'blob'
  })
  return response.data
}

export async function cleanupLogs(daysOld: number = 90): Promise<{ message: string; deleted_count: number }> {

  const response = await api.post(API_ENDPOINTS.LOGS_CLEANUP, { days_old: daysOld })
  return response.data
}
