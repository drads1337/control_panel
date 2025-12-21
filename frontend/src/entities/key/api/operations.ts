import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { LicenseKey } from '../model/types'

export async function deleteLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.delete(`${API_ENDPOINTS.KEYS}/${keyId}`)
  return response.data
}

export async function resetLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/reset`)
  return response.data
}

export async function pauseLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/pause`)
  return response.data
}

export async function resumeLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/resume`)
  return response.data
}

export async function extendLicenseKey(keyId: number, hours: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/extend`, { hours })
  return response.data
}

export async function updateLicenseKey(keyId: number, data: { max_devices?: number; duration?: number }): Promise<{ message: string }> {

  const response = await api.put(`${API_ENDPOINTS.KEYS}/${keyId}`, data)
  return response.data
}

export async function duplicateLicenseKey(keyId: number): Promise<{ message: string; key: LicenseKey }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/duplicate`)
  return response.data
}

export async function moveLicenseKey(keyId: number, productId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/move`, { product_id: productId })
  return response.data
}

export async function validateLicenseKey(keyValue: string): Promise<{ valid: boolean; message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_VALIDATE, { key: keyValue })
  return response.data
}

export async function getLicenseKeyDetails(keyId: number): Promise<{ key: LicenseKey; devices: any[]; usage_history: any[] }> {

  const response = await api.get(`${API_ENDPOINTS.KEYS}/${keyId}/details`)
  return response.data
}

export async function revealLicenseKey(keyId: number): Promise<{ key: string; key_masked: boolean; id: number }> {

  const response = await api.get(`${API_ENDPOINTS.KEYS}/${keyId}/reveal`)
  return response.data
}

export async function getLicenseKeyAnalytics(keyId: number): Promise<{
  key_id: number;
  summary: {
    total_connections_all_time: number;
    max_unique_devices_all_time: number;
    products_played: string[];
    analytics_days_count: number;
    first_analytics_date: string | null;
    last_analytics_date: string | null;
  };
  daily_analytics: Array<{
    date: string;
    total_connections: number;
    unique_devices: number;
    total_connection_time: number;
    peak_concurrent: number;
    products_played: string[];
    created_at: string | null;
    updated_at: string | null;
  }>;
}> {

  const response = await api.get(`${API_ENDPOINTS.KEYS}/${keyId}/analytics`)
  return response.data
}

export async function exportLicenseKey(keyId: number): Promise<{ download_url: string }> {

  const response = await api.get(`${API_ENDPOINTS.KEYS}/${keyId}/export`)
  return response.data
}

export async function blockLicenseKey(keyId: number): Promise<{ message: string; key?: { id: number; status: number; is_active: boolean; is_expired: boolean; expires_at?: string | null } }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/block`)
  return response.data
}

export async function unblockLicenseKey(keyId: number): Promise<{ message: string; key?: { id: number; status: number; is_active: boolean; is_expired: boolean; expires_at?: string | null } }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/unblock`)
  return response.data
}

export async function archiveLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/archive`)
  return response.data
}

export async function restoreLicenseKey(keyId: number): Promise<{ message: string }> {

  const response = await api.post(`${API_ENDPOINTS.KEYS}/${keyId}/restore`)
  return response.data
}
