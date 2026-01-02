import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityAPI, SecurityRule } from '@/shared/api/security'
import { toast } from 'sonner'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import { COUNTRIES } from '../utils/countries'
import { Checkbox } from '@/components/ui/checkbox'
import { Globe, Shield, Lock } from 'lucide-react'

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

interface FailedLoginSettings {
  enabled: boolean
  maxFailedAttempts: number
  timeWindowMinutes: number
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
  const [failedLogin, setFailedLogin] = useState<FailedLoginSettings>({
    enabled: true,
    maxFailedAttempts: 5,
    timeWindowMinutes: 15,
    blockDurationHours: 1
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
        } else if (rule.name === 'Failed Login Protection') {
          setFailedLogin({
            enabled: ruleDetails.is_active,
            maxFailedAttempts: conditions.max_failed_attempts || 5,
            timeWindowMinutes: conditions.time_window_minutes || 15,
            blockDurationHours: actionParams.block_duration_hours || 1
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

  // Update Failed Login rule
  const updateFailedLoginMutation = useMutation({
    mutationFn: async (settings: FailedLoginSettings) => {
      if (!rule || rule.name !== 'Failed Login Protection') {
        throw new Error('Failed Login Protection rule not found')
      }

      const conditions = {
        max_failed_attempts: settings.maxFailedAttempts,
        time_window_minutes: settings.timeWindowMinutes
      }

      const actionParams = {
        severity: 'high',
        block_duration_hours: settings.blockDurationHours
      }

      return securityAPI.updateSecurityRule(rule.id, {
        conditions,
        action_params: actionParams,
        is_active: settings.enabled
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Failed login protection settings updated')
      onRefresh?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update failed login settings')
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

  const handleSaveFailedLogin = useCallback(() => {
    if (!canManageRules) return
    updateFailedLoginMutation.mutate(failedLogin)
  }, [failedLogin, canManageRules, updateFailedLoginMutation])

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
                   updateFailedLoginMutation.isPending

  // Determine which settings to show based on rule name
  const showGeoBlocking = rule?.name === 'Geo-blocking'
  const showBruteForce = rule?.name === 'Brute Force Protection'
  const showFailedLogin = rule?.name === 'Failed Login Protection'
  const showSettings = showGeoBlocking || showBruteForce || showFailedLogin

  if (!rule || !showSettings) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showFailedLogin ? "w-full sm:max-w-[500px] p-0 gap-0 overflow-hidden" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        {showFailedLogin ? (
          <>
            {/* Header */}
            <DialogHeader className="p-4 pb-1 bg-muted/5 pr-12">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Failed Login Protection
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Block IPs after multiple failed login attempts
                  </DialogDescription>
                </div>
                <Switch
                  checked={failedLogin.enabled}
                  onCheckedChange={(checked) => {
                    if (!canManageRules) return
                    setFailedLogin(prev => ({ ...prev, enabled: checked }))
                  }}
                  disabled={!canManageRules || loading || isSaving}
                />
              </div>
            </DialogHeader>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              {failedLogin.enabled ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="failed-max-attempts" className="text-xs font-medium">
                      Max Failed Attempts *
                    </Label>
                    <Input
                      id="failed-max-attempts"
                      type="number"
                      min="1"
                      max="20"
                      value={failedLogin.maxFailedAttempts}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setFailedLogin(prev => ({ ...prev, maxFailedAttempts: Math.max(1, Math.min(20, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Number of failed login attempts before blocking
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="failed-time-window" className="text-xs font-medium">
                      Time Window (minutes) *
                    </Label>
                    <Input
                      id="failed-time-window"
                      type="number"
                      min="1"
                      max="1440"
                      value={failedLogin.timeWindowMinutes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setFailedLogin(prev => ({ ...prev, timeWindowMinutes: Math.max(1, Math.min(1440, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Time window to count failed attempts
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="failed-block-duration" className="text-xs font-medium">
                      Block Duration (hours) *
                    </Label>
                    <Input
                      id="failed-block-duration"
                      type="number"
                      min="0.5"
                      max="168"
                      step="0.5"
                      value={failedLogin.blockDurationHours}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0.5
                        setFailedLogin(prev => ({ ...prev, blockDurationHours: Math.max(0.5, Math.min(168, value)) }))
                      }}
                      disabled={!canManageRules || isSaving}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      How long to block the IP after threshold is reached
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Failed login protection is disabled. Enable it to configure settings.
                </div>
              )}
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
                onClick={handleSaveFailedLogin}
                disabled={!canManageRules || loading || isSaving || !failedLogin.enabled}
                className="h-8 text-xs min-w-[80px]"
              >
                {updateFailedLoginMutation.isPending ? (
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
            
            <div className="space-y-4">
          {/* Geo-blocking Settings */}
          {showGeoBlocking && (
            <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base sm:text-lg">Geo-blocking</CardTitle>
            </div>
            <Switch
              checked={geoBlocking.enabled}
              onCheckedChange={(checked) => {
                if (!canManageRules) return
                setGeoBlocking(prev => ({ ...prev, enabled: checked }))
              }}
              disabled={!canManageRules || loading || isSaving}
            />
          </div>
          <CardDescription className="mt-1 text-xs sm:text-sm">
            Block or allow connections from specific countries
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-0 pt-3 space-y-3">
          {geoBlocking.enabled && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={geoBlocking.mode === 'block' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGeoBlocking(prev => ({ ...prev, mode: 'block' }))}
                    disabled={!canManageRules || isSaving}
                    className="text-xs h-7"
                  >
                    Block Countries
                  </Button>
                  <Button
                    type="button"
                    variant={geoBlocking.mode === 'allow' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGeoBlocking(prev => ({ ...prev, mode: 'allow' }))}
                    disabled={!canManageRules || isSaving}
                    className="text-xs h-7"
                  >
                    Allow Only
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {geoBlocking.mode === 'block' ? 'Blocked Countries' : 'Allowed Countries'}
                </Label>
                <Input
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1">
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
                  <div className="text-xs text-muted-foreground">
                    {geoBlocking.blockedCountries.length} {geoBlocking.mode === 'block' ? 'blocked' : 'allowed'} countries
                  </div>
                )}
              </div>

              <Button
                onClick={handleSaveGeoBlocking}
                disabled={!canManageRules || loading || isSaving}
                size="sm"
                className="w-full text-xs h-8"
              >
                {updateGeoBlockingMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-3 w-3" />
                    Saving...
                  </>
                ) : (
                  'Save Geo-blocking Settings'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
          )}

          {/* Brute Force Protection Settings */}
          {showBruteForce && (
            <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base sm:text-lg">Brute Force Protection</CardTitle>
            </div>
            <Switch
              checked={bruteForce.enabled}
              onCheckedChange={(checked) => {
                if (!canManageRules) return
                setBruteForce(prev => ({ ...prev, enabled: checked }))
              }}
              disabled={!canManageRules || loading || isSaving}
            />
          </div>
          <CardDescription className="mt-1 text-xs sm:text-sm">
            Block IPs after multiple failed authentication attempts
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-0 pt-3 space-y-3">
          {bruteForce.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="brute-max-attempts" className="text-xs font-medium">
                  Max Attempts
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
                <p className="text-xs text-muted-foreground">
                  Number of failed attempts before blocking
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brute-time-window" className="text-xs font-medium">
                  Time Window (minutes)
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
                <p className="text-xs text-muted-foreground">
                  Time window to count attempts
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brute-block-duration" className="text-xs font-medium">
                  Block Duration (minutes)
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
                <p className="text-xs text-muted-foreground">
                  How long to block the IP after threshold is reached
                </p>
              </div>

              <Button
                onClick={handleSaveBruteForce}
                disabled={!canManageRules || loading || isSaving}
                size="sm"
                className="w-full text-xs h-8"
              >
                {updateBruteForceMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-3 w-3" />
                    Saving...
                  </>
                ) : (
                  'Save Brute Force Settings'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
          )}

          {(isLoadingDetails || loading) && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

