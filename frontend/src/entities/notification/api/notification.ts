import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { GameNotification, GameNotificationsResponse } from '@/entities/notification';
import type { Game } from '@/entities/game';
import type {
  GameNotification as GameNotificationType,
  GameNotificationsResponse as GameNotificationsResponseType
} from '../model/types'

// Notification API functions
// All functions use centralized axios instance with CSRF protection
export async function sendGameNotification(gameId: number, data: {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | string;
  repeatCount?: number;
  is_scheduled?: boolean;
  scheduled_at?: string | null;
}): Promise<{ message: string; notifications_created: number; game_name: string }> {
  const requestData = {
    game_id: gameId,
    version: '1.0.0', // Default version, can be made configurable later
    message: `${data.title}: ${data.message}`,
    type: data.type,
    repeat_count: data.repeatCount || 1,
    is_scheduled: data.is_scheduled || false,
    scheduled_at: data.scheduled_at
  };

  console.log('Sending game notification:', requestData);

  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.post(API_ENDPOINTS.NOTIFICATIONS_GAME_UPDATE, requestData)
  console.log('Game notification success:', response.data);
  return response.data;
}

export async function getGameNotifications(gameId: number): Promise<GameNotificationsResponseType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(`${API_ENDPOINTS.NOTIFICATIONS_GAMES}/${gameId}/notifications`)
  return response.data;
}

export async function deleteNotification(notificationId: number): Promise<{ message: string }> {
  console.log(`[API] Deleting notification ${notificationId}`)
  
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.delete(`/api/notifications/${notificationId}`)
  
  console.log(`[API] Response status: ${response.status}`)
  console.log(`[API] Success response:`, response.data)
  return response.data
}

export async function bulkNotificationAction(action: 'mark_read' | 'mark_unread' | 'delete', notificationIds: number[]): Promise<{ message: string }> {
  // CSRF token and credentials are automatically handled by axios interceptors
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
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.post(`/api/notifications/${notificationId}/show`)
  return response.data
}
