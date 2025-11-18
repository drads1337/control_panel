import { useCallback, useMemo } from 'react'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import { useBlockedIPs, useBlockedHWIDs } from '@/hooks/use-security-query'

interface SecurityStats {
  totalBlocks: number
  activeBlocks: number
  blockedIPs: number
  blockedHWIDs: number
  threatLevel: string
  recentThreats: number
}

export function useSecurityActions() {
  const securityPermissions = useSecurityPermissions()
  const { blockedIPs = [], loading: ipLoading, blockIP, unblockIP } = useBlockedIPs()
  const { blockedHWIDs = [], loading: hwidLoading, blockHWID, unblockHWID } = useBlockedHWIDs()

  const stats: SecurityStats = useMemo(() => {
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
  }, [blockedIPs, blockedHWIDs])

  const loading = ipLoading || hwidLoading

  const handleUnblockIP = useCallback(async (ipId: number) => {
    if (!securityPermissions.canUnblockIPs) {
      return
    }
    try {
      await unblockIP(ipId)
    } catch (error) {

    }
  }, [unblockIP, securityPermissions.canUnblockIPs])

  const handleUnblockHWID = useCallback(async (hwidId: number) => {
    if (!securityPermissions.canUnblockHWIDs) {
      return
    }
    try {
      await unblockHWID(hwidId)
    } catch (error) {

    }
  }, [unblockHWID, securityPermissions.canUnblockHWIDs])

  const handleViewIPDetails = useCallback((ip: any) => {

  }, [])

  const handleViewHWIDDetails = useCallback((hwid: any) => {

  }, [])

  const handleBlockIP = useCallback(async (data: any) => {
    if (!securityPermissions.canBlockIPs) {
      return
    }
    try {
      await blockIP(data)
    } catch (error) {

    }
  }, [blockIP, securityPermissions.canBlockIPs])

  const handleBlockHWID = useCallback(async (data: any) => {
    if (!securityPermissions.canBlockHWIDs) {
      return
    }
    try {
      await blockHWID(data)
    } catch (error) {

    }
  }, [blockHWID, securityPermissions.canBlockHWIDs])

  return {
    stats,
    loading,
    blockedIPs,
    blockedHWIDs,
    handleUnblockIP,
    handleUnblockHWID,
    handleViewIPDetails,
    handleViewHWIDDetails,
    handleBlockIP,
    handleBlockHWID,
  }
}
