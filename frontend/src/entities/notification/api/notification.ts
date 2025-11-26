import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ProductNotification, ProductNotificationsResponse } from '@/entities/notification';
import type { Product } from '@/entities/product';
import type {
  ProductNotification as ProductNotificationType,
  ProductNotificationsResponse as ProductNotificationsResponseType
} from '../model/types'

export async function sendProductNotification(productId: number, data: {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | string;
  repeatCount?: number;
  is_scheduled?: boolean;
  scheduled_at?: string | null;
}): Promise<{ message: string; notifications_created: number; product_name: string }> {
  const requestData = {
    message: `${data.title}: ${data.message}`,
    type: data.type,
    repeat_count: data.repeatCount || 1,
    is_scheduled: data.is_scheduled || false,
    scheduled_at: data.scheduled_at
  };

  const response = await api.post(`/api/notifications/products/${productId}/notifications`, requestData)

  return response.data;
}

export async function getProductNotifications(productId: number): Promise<ProductNotificationsResponseType> {

  const response = await api.get(`${API_ENDPOINTS.NOTIFICATIONS_PRODUCTS}/${productId}/notifications`)
  return response.data;
}

export async function deleteNotification(notificationId: number): Promise<{ message: string }> {

  const response = await api.delete(`/api/notifications/${notificationId}`)

  return response.data
}

export async function bulkNotificationAction(action: 'mark_read' | 'mark_unread' | 'delete', notificationIds: number[]): Promise<{ message: string }> {

  const response = await api.post('/api/notifications/bulk', {
      action,
      notification_ids: notificationIds
    })
  return response.data;
}

export async function incrementNotificationShowCount(notificationId: number): Promise<{
  message: string;
  show_count: number;
  repeat_count: number;
  is_read: boolean;
}> {

  const response = await api.post(`/api/notifications/${notificationId}/show`)
  return response.data
}

export async function getAgentNotifications(agentId: number): Promise<ProductNotificationsResponseType> {
  const response = await api.get(`/api/notifications/agents/${agentId}/notifications`)
  return response.data;
}

export async function sendAgentNotification(agentId: number, data: {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | string;
  is_scheduled?: boolean;
  scheduled_at?: string | null;
}): Promise<{ message: string; notifications_created: number; agent_name: string }> {
  const requestData = {
    message: data.message,
    type: data.type,
    is_scheduled: data.is_scheduled || false,
    scheduled_at: data.scheduled_at
  };

  const response = await api.post(`/api/notifications/agents/${agentId}/notifications`, requestData)
  return response.data;
}

export interface UserNotification {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
  user_id?: number | null;
  project_id?: number | null;
  show_count?: number;
  repeat_count?: number;
}

export interface UserNotificationsResponse {
  notifications: UserNotification[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export async function getUserNotifications(params?: {
  page?: number;
  per_page?: number;
  unread_only?: boolean;
  type?: string;
}): Promise<UserNotificationsResponse> {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS, { params })
  return response.data;
}