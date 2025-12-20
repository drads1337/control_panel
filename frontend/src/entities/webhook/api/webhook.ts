import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import type { WebhookData, WebhookFormData, WebhookStats, WebhookLog } from "@/features/webhooks-control/types"

export interface CreateWebhookRequest {
  name: string
  webhook_type: 'telegram' | 'discord' | 'custom'
  url?: string
  events: string[]
  secret?: string
  is_active: boolean
  headers?: Record<string, string>
  telegram_bot_token?: string
  telegram_chat_id?: string
  discord_webhook_url?: string
  discord_bot_token?: string
  discord_channel_id?: string
}

export interface UpdateWebhookRequest extends Partial<CreateWebhookRequest> {
  id: number
}

export interface WebhookResponse {
  status: string
  data: WebhookData
}

export interface WebhooksResponse {
  status: string
  data: WebhookData[]
}

export interface WebhookStatsResponse {
  status: string
  data: WebhookStats
}

export interface WebhookLogsResponse {
  status: string
  data: WebhookLog[]
}

export interface TestWebhookResponse {
  status: string
  data: {
    success: boolean
    status_code?: number
    response_text?: string
    error_message?: string
  }
}

export interface TriggerWebhookResponse {
  status: string
  message: string
  success?: boolean
  data?: any
}

export const webhookAPI = {

  async getWebhooks(): Promise<WebhookData[]> {
    const response = await api.get<WebhooksResponse>(`${API_ENDPOINTS.WEBHOOKS}/`)
    return response.data.data || []
  },

  async getWebhookStats(): Promise<WebhookStats> {
    const response = await api.get<WebhookStatsResponse>(API_ENDPOINTS.WEBHOOKS_STATS)
    return response.data.data
  },

  async createWebhook(data: CreateWebhookRequest): Promise<WebhookData> {
    const response = await api.post<WebhookResponse>(`${API_ENDPOINTS.WEBHOOKS}/`, data)
    return response.data.data
  },

  async updateWebhook(id: number, data: Partial<CreateWebhookRequest>): Promise<WebhookData> {
    const response = await api.put<WebhookResponse>(`${API_ENDPOINTS.WEBHOOKS}/${id}`, data)
    return response.data.data
  },

  async deleteWebhook(id: number): Promise<void> {
    await api.delete(`${API_ENDPOINTS.WEBHOOKS}/${id}`)
  },

  async testWebhook(id: number): Promise<TestWebhookResponse['data']> {
    const response = await api.post<TestWebhookResponse>(`${API_ENDPOINTS.WEBHOOKS}/${id}/test`)
    return response.data.data
  },

  async getWebhookLogs(id: number, limit: number = 100): Promise<WebhookLog[]> {
    const response = await api.get<WebhookLogsResponse>(`${API_ENDPOINTS.WEBHOOKS}/${id}/logs`, {
      params: { limit }
    })
    return response.data.data || []
  },

  async getWebhookEvents(): Promise<{ events: string[], categories: Record<string, string[]> }> {
    const response = await api.get<{ status: string, data: { events: string[], categories: Record<string, string[]> } }>(API_ENDPOINTS.WEBHOOKS_EVENTS)
    return response.data.data
  },

  async triggerWebhook(event: string, data: any, projectId?: number): Promise<TriggerWebhookResponse> {
    const response = await api.post<TriggerWebhookResponse>(API_ENDPOINTS.WEBHOOKS_TRIGGER, {
      event,
      data,
      project_id: projectId
    })
    return response.data
  },

  async testTriggerWebhook(event: string = 'key.created', data?: any): Promise<TriggerWebhookResponse> {
    const response = await api.post<TriggerWebhookResponse>(API_ENDPOINTS.WEBHOOKS_TEST_TRIGGER, {
      event,
      data
    })
    return response.data
  }
}

export const {
  getWebhooks,
  getWebhookStats,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
  getWebhookEvents,
  triggerWebhook,
  testTriggerWebhook
} = webhookAPI
