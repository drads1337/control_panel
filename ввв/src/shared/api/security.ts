import { enhancedApi } from './enhanced-client'

// Types
export interface BlockedIP {
  id: number
  ip_address: string
  reason: string | null
  blocked_at: string
  expires_at: string | null
  is_active: boolean
  block_type: string | null
  category: string | null
  severity: string | null
  threat_score: number | null
  country: string | null
  city: string | null
  attempt_count: number | null
  blocked_by: string | null
  unblocked_at: string | null
  unblocked_by: string | null
}

export interface BlockedHWID {
  id: number
  hwid: string
  reason: string | null
  blocked_at: string
  expires_at: string | null
  is_active: boolean
  block_type: string | null
  severity: string | null
  threat_score: number | null
  cpu_info: string | null
  gpu_info: string | null
  motherboard_info: string | null
  ram_info: string | null
  attempt_count: number | null
  blocked_by: string | null
  unblocked_at: string | null
  unblocked_by: string | null
}

export interface SecurityStats {
  totalBlocks: number
  activeBlocks: number
  blockedIPs: number
  blockedHWIDs: number
  threatLevel: string
  recentThreats: number
}

export interface CreateIPBlockRequest {
  ip_address: string
  reason?: string
  block_type?: string
  category?: string
  severity?: string
  threat_score?: number
  expires_at?: string
}

export interface CreateHWIDBlockRequest {
  hwid: string
  reason?: string
  block_type?: string
  severity?: string
  threat_score?: number
  expires_at?: string
}

// API Client
export const securityAPI = {
  /**
   * Get security statistics
   */
  async getSecurityStats(): Promise<SecurityStats> {
    try {
      const response = await enhancedApi.get<SecurityStats | { status: string; data: SecurityStats }>(
        '/api/settings/security/analytics'
      )
      
      // Handle wrapped response format
      if (response.data && typeof response.data === 'object' && 'status' in response.data) {
        const wrapped = response.data as { status: string; data: SecurityStats }
        if (wrapped.status === 'success' && wrapped.data) {
          return wrapped.data
        }
      }
      
      // Handle direct response format
      if (response.data && typeof response.data === 'object') {
        const data = response.data as any
        // Map backend analytics format to SecurityStats
        if (data.total_blocked !== undefined || data.blocked_ips !== undefined) {
          return {
            totalBlocks: data.total_blocked || 0,
            activeBlocks: data.active_blocks || 0,
            blockedIPs: data.blocked_ips || 0,
            blockedHWIDs: data.blocked_hwids || 0,
            threatLevel: data.threat_level || 'Medium',
            recentThreats: data.recent_threats || 0
          }
        }
      }
    } catch (error) {
      // If analytics endpoint fails, calculate from blocked IPs and HWIDs
    }
    
    // Fallback: calculate stats from blocked IPs and HWIDs
    const [blockedIPs, blockedHWIDs] = await Promise.all([
      this.getBlockedIPs(),
      this.getBlockedHWIDs()
    ])
    
    const activeIPs = blockedIPs.filter(ip => ip.is_active)
    const activeHWIDs = blockedHWIDs.filter(hwid => hwid.is_active)
    
    return {
      totalBlocks: blockedIPs.length + blockedHWIDs.length,
      activeBlocks: activeIPs.length + activeHWIDs.length,
      blockedIPs: activeIPs.length,
      blockedHWIDs: activeHWIDs.length,
      threatLevel: 'High',
      recentThreats: 5
    }
  },

  /**
   * Get all blocked IP addresses
   */
  async getBlockedIPs(): Promise<BlockedIP[]> {
    const response = await enhancedApi.get<{ blocked_ips: BlockedIP[] }>(
      '/api/settings/security/blocked-ips'
    )
    return response.data.blocked_ips || []
  },

  /**
   * Block an IP address
   */
  async blockIP(data: CreateIPBlockRequest): Promise<{ id: number; message: string }> {
    const response = await enhancedApi.post<{ message: string; id: number }>(
      '/api/settings/security/blocked-ips',
      data
    )
    return response.data
  },

  /**
   * Unblock an IP address
   */
  async unblockIP(ipId: number): Promise<void> {
    await enhancedApi.delete(`/api/settings/security/blocked-ips/${ipId}`)
  },

  /**
   * Get all blocked hardware IDs
   */
  async getBlockedHWIDs(): Promise<BlockedHWID[]> {
    const response = await enhancedApi.get<{ blocked_hwids: BlockedHWID[] }>(
      '/api/settings/security/blocked-hwids'
    )
    return response.data.blocked_hwids || []
  },

  /**
   * Block a hardware ID
   */
  async blockHWID(data: CreateHWIDBlockRequest): Promise<{ id: number; message: string }> {
    const response = await enhancedApi.post<{ message: string; id: number }>(
      '/api/settings/security/blocked-hwids',
      data
    )
    return response.data
  },

  /**
   * Unblock a hardware ID
   */
  async unblockHWID(hwidId: number): Promise<void> {
    await enhancedApi.delete(`/api/settings/security/blocked-hwids/${hwidId}`)
  },
}