import { enhancedApi as apiClient } from '../enhanced-client'

export interface BlockedIP {
  id: number
  ip_address: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  country?: string
  city?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

export interface BlockedHWID {
  id: number
  hwid: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  cpu_info?: string
  gpu_info?: string
  motherboard_info?: string
  ram_info?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

export interface CreateIPBlockRequest {
  ip_address: string
  reason: string
  expires_at?: string
  block_type?: string
  category?: string
  severity?: string
  threat_score?: number
}

export interface CreateHWIDBlockRequest {
  hwid: string
  reason: string
  expires_at?: string
  block_type?: string
  category?: string
  severity?: string
  threat_score?: number
}

export interface SecurityStats {
  totalBlocks: number
  activeBlocks: number
  blockedIPs: number
  blockedHWIDs: number
  threatLevel: string
  recentThreats: number
}

export interface SecurityRule {
  id: number
  name: string
  description: string
  type: 'ip' | 'hwid' | 'behavior' | 'geo'
  action: 'block' | 'allow' | 'monitor'
  severity: 'low' | 'medium' | 'high' | 'critical'
  isActive: boolean
  createdAt: string
  updatedAt: string
  triggerCount: number
  lastTriggered?: string
}

export interface SecurityEvent {
  id: number
  event_type: string
  severity: string
  fingerprint?: string
  ip_address?: string
  user_agent?: string
  user_key?: string
  country?: string
  city?: string
  description?: string
  threat_score: number
  created_at: string
}

export interface SecurityAnalytics {
  total_blocked: number
  block_types: Record<string, number>
  severity_distribution: Record<string, number>
  threat_score_avg: number
  top_countries: Record<string, number>
  top_user_agents: Record<string, number>
  timeline: Record<string, number>
  recent_events: SecurityEvent[]
}

export interface SecurityEventsResponse {
  events: SecurityEvent[]
  total: number
  pages: number
  current_page: number
}

class SecurityAPI {

  async getBlockedIPs(): Promise<BlockedIP[]> {
    const response = await apiClient.get('/api/settings/security/blocked-ips')
    // Backend returns { blocked_ips: [...] }
    if (response.data?.blocked_ips && Array.isArray(response.data.blocked_ips)) {
      return response.data.blocked_ips
    }
    // Fallback for direct array response
    return Array.isArray(response.data) ? response.data : []
  }

  async blockIP(data: CreateIPBlockRequest): Promise<{ message: string; id: number }> {
    const response = await apiClient.post('/api/settings/security/blocked-ips', data)
    return response.data
  }

  async unblockIP(ipId: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/settings/security/blocked-ips/${ipId}`)
    return response.data
  }

  async getBlockedHWIDs(): Promise<BlockedHWID[]> {
    const response = await apiClient.get('/api/settings/security/blocked-hwids')
    // Backend returns { blocked_hwids: [...] }
    if (response.data?.blocked_hwids && Array.isArray(response.data.blocked_hwids)) {
      return response.data.blocked_hwids
    }
    // Fallback for direct array response
    return Array.isArray(response.data) ? response.data : []
  }

  async blockHWID(data: CreateHWIDBlockRequest): Promise<{ message: string; id: number }> {
    const response = await apiClient.post('/api/settings/security/blocked-hwids', data)
    return response.data
  }

  async unblockHWID(hwidId: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/settings/security/blocked-hwids/${hwidId}`)
    return response.data
  }

  async getSecurityStats(): Promise<SecurityStats> {

    const [blockedIPs, blockedHWIDs] = await Promise.all([
      this.getBlockedIPs(),
      this.getBlockedHWIDs()
    ])

    const activeIPs = blockedIPs.filter(ip => ip.is_active).length
    const activeHWIDs = blockedHWIDs.filter(hwid => hwid.is_active).length
    const totalBlocks = blockedIPs.length + blockedHWIDs.length
    const activeBlocks = activeIPs + activeHWIDs

    return {
      totalBlocks,
      activeBlocks,
      blockedIPs: activeIPs,
      blockedHWIDs: activeHWIDs,
      threatLevel: activeBlocks > 20 ? 'High' : activeBlocks > 10 ? 'Medium' : 'Low',
      recentThreats: 0
    }
  }

  async getSecurityRules(): Promise<SecurityRule[]> {
    const response = await apiClient.get('/api/settings/security/rules')
    return Array.isArray(response.data.security_rules) ? response.data.security_rules : []
  }

  async toggleSecurityRule(ruleId: number): Promise<{ message: string; rule: { id: number; name: string; is_active: boolean } }> {
    const response = await apiClient.post(`/api/settings/security/rules/${ruleId}/toggle`)
    return response.data
  }

  async getSecurityEvents(page: number = 1, perPage: number = 50): Promise<SecurityEventsResponse> {
    const response = await apiClient.get('/api/settings/security/events', {
      params: { page, per_page: perPage }
    })
    return response.data
  }

  async getSecurityAnalytics(days: number = 30): Promise<SecurityAnalytics> {
    const response = await apiClient.get('/api/settings/security/analytics', {
      params: { days }
    })
    return response.data
  }
}

export const securityAPI = new SecurityAPI()
