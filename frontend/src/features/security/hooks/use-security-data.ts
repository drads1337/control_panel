import { useState, useCallback, useEffect } from 'react'
import { usePermissions } from '@/shared/hooks'
import { securityAPI } from '@/shared/api/security'
import { toast } from 'sonner'
import { getErrorMessage, isAxiosError } from '@/shared/lib/utils/error-utils'
import type { SecurityStats, SecurityEvent, SecurityAnalytics, SecurityRule } from '@/shared/api/security'

export function useSecurityData() {
  const { hasPermission } = usePermissions()

  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [analytics, setAnalytics] = useState<SecurityAnalytics | null>(null)
  const [rules, setRules] = useState<SecurityRule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)
    try {
      const [statsResponse, eventsResponse, analyticsResponse, rulesResponse] = await Promise.allSettled([
        securityAPI.getSecurityStats(),
        securityAPI.getSecurityEvents(1, 10),
        securityAPI.getSecurityAnalytics(7),
        securityAPI.getSecurityRules()
      ])

      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value)
      } else {
        if (showLoading) {
          setStats(null)
        }
      }

      if (eventsResponse.status === 'fulfilled') {
        setEvents(eventsResponse.value.events || [])
      } else {
        if (showLoading) {
          setEvents([])
        }
      }

      if (analyticsResponse.status === 'fulfilled') {
        setAnalytics(analyticsResponse.value)
      } else {
        if (showLoading) {
          setAnalytics(null)
        }
      }

      if (rulesResponse.status === 'fulfilled') {
        setRules(rulesResponse.value)
      } else {
        if (showLoading) {
          setRules([])
        }
      }
    } catch (err: unknown) {
      let errorMessage = 'Error loading security data'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      if (showLoading) {
        setError(errorMessage)
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    await loadData(false)
  }, [loadData])

  const calculateSecurityScore = useCallback((): number => {
    if (!stats || !analytics) {
      return 98 // Default score
    }

    let score = 100

    // Deduct points for active blocks
    score -= Math.min(stats.activeBlocks * 0.5, 10)

    // Deduct points for high threat score average
    if (analytics.threat_score_avg > 70) {
      score -= 5
    } else if (analytics.threat_score_avg > 50) {
      score -= 2
    }

    // Deduct points for recent threats
    const recentEvents = analytics.recent_events || []
    const criticalEvents = recentEvents.filter(e => e.severity === 'critical').length
    score -= Math.min(criticalEvents * 2, 10)

    return Math.max(0, Math.min(100, Math.round(score)))
  }, [stats, analytics])

  const getFailedAuthCount = useCallback((): number => {
    if (!events) return 0
    // Count failed login attempts in last 24 hours
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)
    return events.filter(event => {
      const eventType = event.event_type?.toLowerCase() || ''
      const eventDate = new Date(event.created_at)
      return (eventType.includes('failed') || eventType.includes('login')) &&
             eventDate > last24h &&
             !event.description?.toLowerCase().includes('successful')
    }).length
  }, [events])

  const getActiveThreatsCount = useCallback((): number => {
    if (!events) return 0
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)
    return events.filter(event => 
      (event.severity === 'high' || event.severity === 'critical') &&
      new Date(event.created_at) > last24h
    ).length
  }, [events])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    stats,
    events,
    analytics,
    rules,
    loading,
    refreshing,
    error,
    loadData,
    handleRefresh,
    calculateSecurityScore,
    getFailedAuthCount,
    getActiveThreatsCount,
  }
}
