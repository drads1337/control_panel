import React, { useState, useEffect, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityAPI, SecurityRule } from '@/shared/api/security'
import { toast } from 'sonner'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import { COUNTRIES } from '../utils/countries'
import { Checkbox } from '@/components/ui/checkbox'

interface SecuritySettingsProps {
  rule: SecurityRule | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
  loading?: boolean
}

interface GeoBlockingSettings {
  enabled: boolean
  blockedCountries: string[]
  mode: 'block' | 'allow' // block = block these countries, allow = only allow these countries
}

interface BruteForceSettings {
  enabled: boolean
  maxAttempts: number
  timeWindowMinutes: number
  blockDurationMinutes: number
}

interface AutoBlockSettings {
  enabled: boolean
  min_threat_score: number
  block_duration_hours: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  priority: number
  cooldown_minutes: number
}

interface RateLimitingSettings {
  enabled: boolean
  maxRequestsPerMinute: number
  timeWindowMinutes: number
  blockDurationMinutes: number
}

interface SuspiciousActivitySettings {
  enabled: boolean
  checkPatterns: {
    rapidConnections: boolean
    fingerprintReuse: boolean
    multipleIPs: boolean
    multipleUserAgents: boolean
  }
  rapidConnectionsThreshold: number
  rapidConnectionsTimeWindowHours: number
  fingerprintReuseThreshold: number
  fingerprintReuseTimeWindowHours: number
  multipleIPsThreshold: number
  multipleIPsTimeWindowHours: number
  multipleUserAgentsThreshold: number
  multipleUserAgentsTimeWindowHours: number
  actionType: 'log' | 'alert' | 'block'
  logSeverity: 'low' | 'medium' | 'high'
  blockDurationHours: number
}

export default function SecuritySettings({ rule, open, onOpenChange, onRefresh, loading = false }: SecuritySettingsProps) {
  const { canManageRules } = useSecurityPermissions()
  const queryClient = useQueryClient()

  const [geoBlocking, setGeoBlocking] = useState<GeoBlockingSettings>({
    enabled: false,
    blockedCountries: [],
    mode: 'block'
  })
  const [bruteForce, setBruteForce] = useState<BruteForceSettings>({
    enabled: true,
    maxAttempts: 10,
    timeWindowMinutes: 5,
    blockDurationMinutes: 30
  })
  const [autoBlock, setAutoBlock] = useState<AutoBlockSettings>({
    enabled: true,
    min_threat_score: 70,
    block_duration_hours: 24,
    severity: 'high',
    priority: 90,
    cooldown_minutes: 60
  })
  const [rateLimiting, setRateLimiting] = useState<RateLimitingSettings>({
    enabled: true,
    maxRequestsPerMinute: 60,
    timeWindowMinutes: 1,
    blockDurationMinutes: 30
  })
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivitySettings>({
    enabled: true,
    checkPatterns: {
      rapidConnections: true,
      fingerprintReuse: true,
      multipleIPs: false,
      multipleUserAgents: false
    },
    rapidConnectionsThreshold: 10,
    rapidConnectionsTimeWindowHours: 1,
    fingerprintReuseThreshold: 3,
    fingerprintReuseTimeWindowHours: 24,
    multipleIPsThreshold: 3,
    multipleIPsTimeWindowHours: 1,
    multipleUserAgentsThreshold: 3,
    multipleUserAgentsTimeWindowHours: 1,
    actionType: 'log',
    logSeverity: 'low',
    blockDurationHours: 24
  })
  const [countrySearch, setCountrySearch] = useState('')
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Load settings from the selected rule
  useEffect(() => {
    if (rule && open) {
      setIsLoadingDetails(true)
      securityAPI.getSecurityRuleDetails(rule.id).then(ruleDetails => {
        const conditions = ruleDetails.conditions || {}
        const actionParams = ruleDetails.action_params || {}

        if (rule.name === 'Geo-blocking') {
          const blockedCountries = conditions.blocked_countries || []
          const allowedCountries = conditions.allowed_countries || []
          setGeoBlocking({
            enabled: ruleDetails.is_active,
            blockedCountries: blockedCountries.length > 0 ? blockedCountries : allowedCountries,
            mode: blockedCountries.length > 0 ? 'block' : 'allow'
          })
        } else if (rule.name === 'Brute Force Protection') {
          setBruteForce({
            enabled: ruleDetails.is_active,
            maxAttempts: conditions.max_attempts || 10,
            timeWindowMinutes: conditions.time_window_minutes || 5,
            blockDurationMinutes: conditions.block_duration_minutes || 30
          })
        } else if (rule.name === 'Auto-block Suspicious IPs') {
          setAutoBlock({
            enabled: ruleDetails.is_active,
            min_threat_score: conditions.min_threat_score || 70,
            block_duration_hours: actionParams.block_duration_hours || 24,
            severity: actionParams.severity || 'high',
            priority: ruleDetails.priority || 90,
            cooldown_minutes: ruleDetails.cooldown_minutes || 60
          })
        } else if (rule.name === 'Rate Limiting Protection') {
          setRateLimiting({
            enabled: ruleDetails.is_active,
            maxRequestsPerMinute: conditions.max_requests_per_minute || 60,
            timeWindowMinutes: conditions.time_window_minutes || 1,
            blockDurationMinutes: actionParams.block_duration_minutes || 30
          })
        } else if (rule.name === 'Suspicious Activity Monitor') {
          const checkPatterns = conditions.check_patterns || ['rapid_connections', 'fingerprint_reuse']
          setSuspiciousActivity({
            enabled: ruleDetails.is_active,
            checkPatterns: {
              rapidConnections: checkPatterns.includes('rapid_connections'),
              fingerprintReuse: checkPatterns.includes('fingerprint_reuse'),
              multipleIPs: checkPatterns.includes('multiple_ips'),
              multipleUserAgents: checkPatterns.includes('multiple_user_agents')
            },
            rapidConnectionsThreshold: conditions.rapid_connections_threshold || 10,
            rapidConnectionsTimeWindowHours: conditions.rapid_connections_time_window_hours || 1,
            fingerprintReuseThreshold: conditions.fingerprint_reuse_threshold || 3,
            fingerprintReuseTimeWindowHours: conditions.fingerprint_reuse_time_window_hours || 24,
            multipleIPsThreshold: conditions.multiple_ips_threshold || 3,
            multipleIPsTimeWindowHours: conditions.multiple_ips_time_window_hours || 1,
            multipleUserAgentsThreshold: conditions.multiple_user_agents_threshold || 3,
            multipleUserAgentsTimeWindowHours: conditions.multiple_user_agents_time_window_hours || 1,
            actionType: actionParams.action_type || ruleDetails.action_type || 'log',
            logSeverity: actionParams.log_severity || 'low',
            blockDurationHours: actionParams.block_duration_hours || 24
          })
        }
      }).catch(() => {
        // Ignore errors, use defaults
      }).finally(() => {
        setIsLoadingDetails(false)
      })
    }
  }, [rule, open])

  // Update Geo-blocking rule
  const updateGeoBlockingMutation = useMutation({
    mutationFn: async (settings: GeoBlockingSettings) => {
      if (!rule || rule.name !== 'Geo-blocking') {
        throw new Error('Geo-blocking rule not found')
      }

      const conditions = {
        blocked_countries: settings.mode === 'block' ? settings.blockedCountries : [],
        allowed_countries: settings.mode === 'allow' ? settings.blockedCountries : []
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        is_active: settings.enabled
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Geo-blocking settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update geo-blocking settings')
    },
  })

  // Update Brute Force rule
  const updateBruteForceMutation = useMutation({
    mutationFn: async (settings: BruteForceSettings) => {
      if (!rule || rule.name !== 'Brute Force Protection') {
        throw new Error('Brute Force Protection rule not found')
      }

      const conditions = {
        max_attempts: settings.maxAttempts,
        time_window_minutes: settings.timeWindowMinutes,
        block_duration_minutes: settings.blockDurationMinutes
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        is_active: settings.enabled
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Brute force protection settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update brute force settings')
    },
  })

  // Update Auto-block Suspicious IPs rule
  const updateAutoBlockMutation = useMutation({
    mutationFn: async (settings: AutoBlockSettings) => {
      if (!rule || rule.name !== 'Auto-block Suspicious IPs') {
        throw new Error('Auto-block Suspicious IPs rule not found')
      }

      const conditions = {
        min_threat_score: settings.min_threat_score
      }

      const actionParams = {
        severity: settings.severity,
        threat_score: settings.min_threat_score,
        block_duration_hours: settings.block_duration_hours
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        action_params: actionParams,
        is_active: settings.enabled,
        priority: settings.priority,
        cooldown_minutes: settings.cooldown_minutes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Auto-block settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update auto-block settings')
    },
  })

  // Update Rate Limiting rule
  const updateRateLimitingMutation = useMutation({
    mutationFn: async (settings: RateLimitingSettings) => {
      if (!rule || rule.name !== 'Rate Limiting Protection') {
        throw new Error('Rate Limiting Protection rule not found')
      }

      const conditions = {
        max_requests_per_minute: settings.maxRequestsPerMinute,
        time_window_minutes: settings.timeWindowMinutes
      }

      const actionParams = {
        block_duration_minutes: settings.blockDurationMinutes,
        log_severity: 'medium'
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        action_params: actionParams,
        is_active: settings.enabled
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Rate limiting protection settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update rate limiting settings')
    },
  })

  // Update Suspicious Activity Monitor rule
  const updateSuspiciousActivityMutation = useMutation({
    mutationFn: async (settings: SuspiciousActivitySettings) => {
      if (!rule || rule.name !== 'Suspicious Activity Monitor') {
        throw new Error('Suspicious Activity Monitor rule not found')
      }

      const checkPatterns: string[] = []
      if (settings.checkPatterns.rapidConnections) checkPatterns.push('rapid_connections')
      if (settings.checkPatterns.fingerprintReuse) checkPatterns.push('fingerprint_reuse')
      if (settings.checkPatterns.multipleIPs) checkPatterns.push('multiple_ips')
      if (settings.checkPatterns.multipleUserAgents) checkPatterns.push('multiple_user_agents')

      const conditions: any = {
        check_patterns: checkPatterns
      }

      if (settings.checkPatterns.rapidConnections) {
        conditions.rapid_connections_threshold = settings.rapidConnectionsThreshold
        conditions.rapid_connections_time_window_hours = settings.rapidConnectionsTimeWindowHours
      }
      if (settings.checkPatterns.fingerprintReuse) {
        conditions.fingerprint_reuse_threshold = settings.fingerprintReuseThreshold
        conditions.fingerprint_reuse_time_window_hours = settings.fingerprintReuseTimeWindowHours
      }
      if (settings.checkPatterns.multipleIPs) {
        conditions.multiple_ips_threshold = settings.multipleIPsThreshold
        conditions.multiple_ips_time_window_hours = settings.multipleIPsTimeWindowHours
      }
      if (settings.checkPatterns.multipleUserAgents) {
        conditions.multiple_user_agents_threshold = settings.multipleUserAgentsThreshold
        conditions.multiple_user_agents_time_window_hours = settings.multipleUserAgentsTimeWindowHours
      }

      const actionParams: any = {
        log_severity: settings.logSeverity
      }

      if (settings.actionType === 'block') {
        actionParams.action_type = 'block'
        actionParams.block_duration_hours = settings.blockDurationHours
      } else if (settings.actionType === 'alert') {
        actionParams.action_type = 'alert'
      } else {
        actionParams.action_type = 'log'
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        action_params: actionParams,
        is_active: settings.enabled
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Suspicious Activity Monitor settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update suspicious activity settings')
    },
  })

  const handleSaveGeoBlocking = useCallback(() => {
    if (!canManageRules) return
    updateGeoBlockingMutation.mutate(geoBlocking)
  }, [geoBlocking, canManageRules, updateGeoBlockingMutation])

  const handleSaveBruteForce = useCallback(() => {
    if (!canManageRules) return
    updateBruteForceMutation.mutate(bruteForce)
  }, [bruteForce, canManageRules, updateBruteForceMutation])

  const handleSaveAutoBlock = useCallback(() => {
    if (!canManageRules) return
    updateAutoBlockMutation.mutate(autoBlock)
  }, [autoBlock, canManageRules, updateAutoBlockMutation])

  const handleSaveRateLimiting = useCallback(() => {
    if (!canManageRules) return
    updateRateLimitingMutation.mutate(rateLimiting)
  }, [rateLimiting, canManageRules, updateRateLimitingMutation])

  const handleSaveSuspiciousActivity = useCallback(() => {
    if (!canManageRules) return
    updateSuspiciousActivityMutation.mutate(suspiciousActivity)
  }, [suspiciousActivity, canManageRules, updateSuspiciousActivityMutation])

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const toggleCountry = (countryCode: string) => {
    if (!canManageRules) return
    setGeoBlocking(prev => ({
      ...prev,
      blockedCountries: prev.blockedCountries.includes(countryCode)
        ? prev.blockedCountries.filter(c => c !== countryCode)
        : [...prev.blockedCountries, countryCode]
    }))
  }

  const isSaving = updateGeoBlockingMutation.isPending || 
                   updateBruteForceMutation.isPending ||
                   updateAutoBlockMutation.isPending ||
                   updateRateLimitingMutation.isPending ||
                   updateSuspiciousActivityMutation.isPending

  // Determine which settings to show based on rule name
  const showGeoBlocking = rule?.name === 'Geo-blocking'
  const showBruteForce = rule?.name === 'Brute Force Protection'
  const showAutoBlock = rule?.name === 'Auto-block Suspicious IPs'
  const showRateLimiting = rule?.name === 'Rate Limiting Protection'
  const showSuspiciousActivity = rule?.name === 'Suspicious Activity Monitor'
  const showSettings = showGeoBlocking || showBruteForce || showAutoBlock || showRateLimiting || showSuspiciousActivity

  if (!rule || !showSettings) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={(showBruteForce || showAutoBlock || showGeoBlocking || showRateLimiting || showSuspiciousActivity) ? "w-full sm:max-w-[600px] p-0 gap-0 overflow-hidden" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        {showBruteForce ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  Brute Force Protection
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Block IPs after multiple failed login attempts
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="brute-max-attempts" className="text-xs font-medium">
                    Max Attempts *
                  </Label>
                  <Input
                    id="brute-max-attempts"
                    type="number"
                    min="1"
                    max="100"
                    value={bruteForce.maxAttempts}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setBruteForce(prev => ({ ...prev, maxAttempts: Math.max(1, Math.min(100, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Number of failed attempts before blocking
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brute-time-window" className="text-xs font-medium">
                    Time Window (minutes) *
                  </Label>
                  <Input
                    id="brute-time-window"
                    type="number"
                    min="1"
                    max="1440"
                    value={bruteForce.timeWindowMinutes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setBruteForce(prev => ({ ...prev, timeWindowMinutes: Math.max(1, Math.min(1440, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Time window to count attempts
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brute-block-duration" className="text-xs font-medium">
                    Block Duration (minutes) *
                  </Label>
                  <Input
                    id="brute-block-duration"
                    type="number"
                    min="1"
                    max="1440"
                    value={bruteForce.blockDurationMinutes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setBruteForce(prev => ({ ...prev, blockDurationMinutes: Math.max(1, Math.min(1440, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    How long to block the IP after threshold is reached
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveBruteForce}
                disabled={!canManageRules || loading || isSaving}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateBruteForceMutation.isPending ? (
                  <Spinner className="size-3" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        ) : showAutoBlock ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  Auto-block Suspicious IPs
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Block IPs after multiple failed login attempts
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-5">
                {/* Threat Score Section */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Threat Score Settings</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Threat score is calculated based on multiple security factors
                    </p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="auto-block-threat-score" className="text-xs font-medium">
                      Minimum Threat Score *
                    </Label>
                    <Input
                      id="auto-block-threat-score"
                      type="number"
                      min="0"
                      max="100"
                      value={autoBlock.min_threat_score}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0
                        setAutoBlock(prev => ({ ...prev, min_threat_score: Math.max(0, Math.min(100, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      IPs with threat score at or above this value will be automatically blocked (0-100)
                    </p>
                  </div>

                  {/* Threat Score Factors Info */}
                  <div className="p-3 bg-muted/30 rounded-md border border-muted-foreground/20">
                    <p className="text-[10px] font-medium mb-2">Threat Score Calculation:</p>
                    <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Suspicious user agent: +20 points</li>
                      <li>Known malicious IP: +30 points</li>
                      <li>Rapid request pattern: +15 points</li>
                      <li>Geographic anomaly: +25 points</li>
                      <li>Fingerprint reuse: +10 points</li>
                    </ul>
                  </div>
                </div>

                {/* Blocking Settings */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Blocking Settings</Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-block-duration" className="text-xs font-medium">
                      Block Duration (hours) *
                    </Label>
                    <Input
                      id="auto-block-duration"
                      type="number"
                      min="1"
                      max="168"
                      value={autoBlock.block_duration_hours}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setAutoBlock(prev => ({ ...prev, block_duration_hours: Math.max(1, Math.min(168, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      How long to block the IP after threat threshold is reached (1-168 hours, 0 = permanent)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-block-severity" className="text-xs font-medium">
                      Severity Level *
                    </Label>
                    <select
                      id="auto-block-severity"
                      value={autoBlock.severity}
                      onChange={(e) => {
                        setAutoBlock(prev => ({ ...prev, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs w-full rounded-md border border-input bg-background px-3 py-1"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      Severity level for blocked IPs (affects logging and notifications)
                    </p>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Advanced Settings</Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-block-priority" className="text-xs font-medium">
                      Rule Priority *
                    </Label>
                    <Input
                      id="auto-block-priority"
                      type="number"
                      min="0"
                      max="1000"
                      value={autoBlock.priority}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0
                        setAutoBlock(prev => ({ ...prev, priority: Math.max(0, Math.min(1000, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Higher priority rules are evaluated first (0-1000, default: 90)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auto-block-cooldown" className="text-xs font-medium">
                      Cooldown Period (minutes) *
                    </Label>
                    <Input
                      id="auto-block-cooldown"
                      type="number"
                      min="0"
                      max="1440"
                      value={autoBlock.cooldown_minutes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0
                        setAutoBlock(prev => ({ ...prev, cooldown_minutes: Math.max(0, Math.min(1440, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Minimum time between rule triggers for the same IP (0-1440 minutes, default: 60)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveAutoBlock}
                disabled={!canManageRules || loading || isSaving}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateAutoBlockMutation.isPending ? (
                  <Spinner className="size-3" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        ) : showGeoBlocking ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  Geo-blocking
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Block or allow connections from specific countries
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={geoBlocking.mode === 'block' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (!canManageRules) return
                        setGeoBlocking(prev => ({ ...prev, mode: 'block' }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="text-xs h-8"
                    >
                      Block Countries
                    </Button>
                    <Button
                      type="button"
                      variant={geoBlocking.mode === 'allow' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (!canManageRules) return
                        setGeoBlocking(prev => ({ ...prev, mode: 'allow' }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="text-xs h-8"
                    >
                      Allow Only
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {geoBlocking.mode === 'block' 
                      ? 'Block connections from selected countries' 
                      : 'Only allow connections from selected countries'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {geoBlocking.mode === 'block' ? 'Blocked Countries' : 'Allowed Countries'}
                  </Label>
                  <Input
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <div className="max-h-[300px] overflow-y-auto border rounded-md p-2 space-y-1">
                    {filteredCountries.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No countries found
                      </div>
                    ) : (
                      filteredCountries.map((country) => {
                        const isSelected = geoBlocking.blockedCountries.includes(country.code)
                        return (
                          <div
                            key={country.code}
                            className="flex items-center space-x-2 p-1.5 hover:bg-muted/50 rounded cursor-pointer"
                            onClick={() => toggleCountry(country.code)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCountry(country.code)}
                              disabled={!canManageRules || isSaving}
                            />
                            <Label className="text-xs cursor-pointer flex-1">
                              {country.name} ({country.code})
                            </Label>
                          </div>
                        )
                      })
                    )}
                  </div>
                  {geoBlocking.blockedCountries.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {geoBlocking.blockedCountries.length} {geoBlocking.mode === 'block' ? 'blocked' : 'allowed'} {geoBlocking.blockedCountries.length === 1 ? 'country' : 'countries'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveGeoBlocking}
                disabled={!canManageRules || loading || isSaving}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateGeoBlockingMutation.isPending ? (
                  <Spinner className="size-3" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        ) : showRateLimiting ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  Rate Limiting Protection
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Block IPs after multiple failed login attempts
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rate-max-requests" className="text-xs font-medium">
                    Max Requests Per Minute *
                  </Label>
                  <Input
                    id="rate-max-requests"
                    type="number"
                    min="0"
                    max="1000"
                    value={rateLimiting.maxRequestsPerMinute}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setRateLimiting(prev => ({ ...prev, maxRequestsPerMinute: Math.max(0, Math.min(1000, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Maximum requests per minute per IP (0 = unlimited)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rate-time-window" className="text-xs font-medium">
                    Time Window (minutes) *
                  </Label>
                  <Input
                    id="rate-time-window"
                    type="number"
                    min="1"
                    max="1440"
                    value={rateLimiting.timeWindowMinutes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setRateLimiting(prev => ({ ...prev, timeWindowMinutes: Math.max(1, Math.min(1440, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Time window to count requests
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rate-block-duration" className="text-xs font-medium">
                    Block Duration (minutes) *
                  </Label>
                  <Input
                    id="rate-block-duration"
                    type="number"
                    min="1"
                    max="1440"
                    value={rateLimiting.blockDurationMinutes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setRateLimiting(prev => ({ ...prev, blockDurationMinutes: Math.max(1, Math.min(1440, value)) }))
                    }}
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    How long to block the IP after threshold is reached
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveRateLimiting}
                disabled={!canManageRules || loading || isSaving}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateRateLimitingMutation.isPending ? (
                  <Spinner className="size-3" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        ) : showSuspiciousActivity ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  Suspicious Activity Monitor
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Monitor unusual access patterns and behaviors
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                {/* Check Patterns */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Monitor Patterns</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="check-rapid-connections"
                        checked={suspiciousActivity.checkPatterns.rapidConnections}
                        onCheckedChange={(checked) =>
                          setSuspiciousActivity(prev => ({
                            ...prev,
                            checkPatterns: {
                              ...prev.checkPatterns,
                              rapidConnections: checked as boolean
                            }
                          }))
                        }
                        disabled={!canManageRules || isSaving}
                      />
                      <Label htmlFor="check-rapid-connections" className="text-xs cursor-pointer flex-1">
                        Rapid Connections
                      </Label>
                    </div>
                    {suspiciousActivity.checkPatterns.rapidConnections && (
                      <div className="ml-6 space-y-2 pl-4 border-l">
                        <div className="space-y-1.5">
                          <Label htmlFor="rapid-threshold" className="text-xs font-medium">
                            Threshold (connections)
                          </Label>
                          <Input
                            id="rapid-threshold"
                            type="number"
                            min="1"
                            max="1000"
                            value={suspiciousActivity.rapidConnectionsThreshold}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                rapidConnectionsThreshold: Math.max(1, Math.min(1000, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Number of connections to trigger alert
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="rapid-window" className="text-xs font-medium">
                            Time Window (hours)
                          </Label>
                          <Input
                            id="rapid-window"
                            type="number"
                            min="1"
                            max="168"
                            value={suspiciousActivity.rapidConnectionsTimeWindowHours}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                rapidConnectionsTimeWindowHours: Math.max(1, Math.min(168, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="check-fingerprint-reuse"
                        checked={suspiciousActivity.checkPatterns.fingerprintReuse}
                        onCheckedChange={(checked) =>
                          setSuspiciousActivity(prev => ({
                            ...prev,
                            checkPatterns: {
                              ...prev.checkPatterns,
                              fingerprintReuse: checked as boolean
                            }
                          }))
                        }
                        disabled={!canManageRules || isSaving}
                      />
                      <Label htmlFor="check-fingerprint-reuse" className="text-xs cursor-pointer flex-1">
                        Fingerprint Reuse
                      </Label>
                    </div>
                    {suspiciousActivity.checkPatterns.fingerprintReuse && (
                      <div className="ml-6 space-y-2 pl-4 border-l">
                        <div className="space-y-1.5">
                          <Label htmlFor="fingerprint-threshold" className="text-xs font-medium">
                            Threshold (unique keys)
                          </Label>
                          <Input
                            id="fingerprint-threshold"
                            type="number"
                            min="1"
                            max="100"
                            value={suspiciousActivity.fingerprintReuseThreshold}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                fingerprintReuseThreshold: Math.max(1, Math.min(100, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Number of different user keys using same fingerprint
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="fingerprint-window" className="text-xs font-medium">
                            Time Window (hours)
                          </Label>
                          <Input
                            id="fingerprint-window"
                            type="number"
                            min="1"
                            max="168"
                            value={suspiciousActivity.fingerprintReuseTimeWindowHours}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                fingerprintReuseTimeWindowHours: Math.max(1, Math.min(168, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="check-multiple-ips"
                        checked={suspiciousActivity.checkPatterns.multipleIPs}
                        onCheckedChange={(checked) =>
                          setSuspiciousActivity(prev => ({
                            ...prev,
                            checkPatterns: {
                              ...prev.checkPatterns,
                              multipleIPs: checked as boolean
                            }
                          }))
                        }
                        disabled={!canManageRules || isSaving}
                      />
                      <Label htmlFor="check-multiple-ips" className="text-xs cursor-pointer flex-1">
                        Multiple IP Addresses
                      </Label>
                    </div>
                    {suspiciousActivity.checkPatterns.multipleIPs && (
                      <div className="ml-6 space-y-2 pl-4 border-l">
                        <div className="space-y-1.5">
                          <Label htmlFor="ips-threshold" className="text-xs font-medium">
                            Threshold (IPs)
                          </Label>
                          <Input
                            id="ips-threshold"
                            type="number"
                            min="1"
                            max="100"
                            value={suspiciousActivity.multipleIPsThreshold}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                multipleIPsThreshold: Math.max(1, Math.min(100, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Number of different IP addresses for same user
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ips-window" className="text-xs font-medium">
                            Time Window (hours)
                          </Label>
                          <Input
                            id="ips-window"
                            type="number"
                            min="1"
                            max="168"
                            value={suspiciousActivity.multipleIPsTimeWindowHours}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                multipleIPsTimeWindowHours: Math.max(1, Math.min(168, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="check-multiple-user-agents"
                        checked={suspiciousActivity.checkPatterns.multipleUserAgents}
                        onCheckedChange={(checked) =>
                          setSuspiciousActivity(prev => ({
                            ...prev,
                            checkPatterns: {
                              ...prev.checkPatterns,
                              multipleUserAgents: checked as boolean
                            }
                          }))
                        }
                        disabled={!canManageRules || isSaving}
                      />
                      <Label htmlFor="check-multiple-user-agents" className="text-xs cursor-pointer flex-1">
                        Multiple User Agents
                      </Label>
                    </div>
                    {suspiciousActivity.checkPatterns.multipleUserAgents && (
                      <div className="ml-6 space-y-2 pl-4 border-l">
                        <div className="space-y-1.5">
                          <Label htmlFor="ua-threshold" className="text-xs font-medium">
                            Threshold (user agents)
                          </Label>
                          <Input
                            id="ua-threshold"
                            type="number"
                            min="1"
                            max="100"
                            value={suspiciousActivity.multipleUserAgentsThreshold}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                multipleUserAgentsThreshold: Math.max(1, Math.min(100, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Number of different user agents for same user
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ua-window" className="text-xs font-medium">
                            Time Window (hours)
                          </Label>
                          <Input
                            id="ua-window"
                            type="number"
                            min="1"
                            max="168"
                            value={suspiciousActivity.multipleUserAgentsTimeWindowHours}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              setSuspiciousActivity(prev => ({
                                ...prev,
                                multipleUserAgentsTimeWindowHours: Math.max(1, Math.min(168, value))
                              }))
                            }}
                            disabled={!canManageRules || isSaving}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="action-type" className="text-xs font-medium">
                    Action Type
                  </Label>
                  <select
                    id="action-type"
                    value={suspiciousActivity.actionType}
                    onChange={(e) =>
                      setSuspiciousActivity(prev => ({
                        ...prev,
                        actionType: e.target.value as 'log' | 'alert' | 'block'
                      }))
                    }
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs w-full rounded-md border border-input bg-background px-3 py-1"
                  >
                    <option value="log">Log Only</option>
                    <option value="alert">Alert</option>
                    <option value="block">Block</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    What to do when suspicious activity is detected
                  </p>
                </div>

                {/* Log Severity */}
                <div className="space-y-1.5">
                  <Label htmlFor="log-severity" className="text-xs font-medium">
                    Log Severity
                  </Label>
                  <select
                    id="log-severity"
                    value={suspiciousActivity.logSeverity}
                    onChange={(e) =>
                      setSuspiciousActivity(prev => ({
                        ...prev,
                        logSeverity: e.target.value as 'low' | 'medium' | 'high'
                      }))
                    }
                    disabled={!canManageRules || isSaving}
                    className="h-8 text-xs w-full rounded-md border border-input bg-background px-3 py-1"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Block Duration (only if action is block) */}
                {suspiciousActivity.actionType === 'block' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="block-duration" className="text-xs font-medium">
                      Block Duration (hours)
                    </Label>
                    <Input
                      id="block-duration"
                      type="number"
                      min="1"
                      max="168"
                      value={suspiciousActivity.blockDurationHours}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setSuspiciousActivity(prev => ({
                          ...prev,
                          blockDurationHours: Math.max(1, Math.min(168, value))
                        }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      How long to block when threshold is reached
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveSuspiciousActivity}
                disabled={!canManageRules || loading || isSaving}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateSuspiciousActivityMutation.isPending ? (
                  <Spinner className="size-3" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{rule.name}</DialogTitle>
              <DialogDescription>{rule.description}</DialogDescription>
            </DialogHeader>
            
            {(isLoadingDetails || loading) && (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}