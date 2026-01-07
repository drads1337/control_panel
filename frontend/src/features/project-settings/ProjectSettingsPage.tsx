"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { Shield, Key, RefreshCw, Settings2, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjectSettings, updateProjectSettings, regenerateKeys, regenerateMasterKey } from '@/entities/settings'
import { AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'
import { usePermissions } from '@/shared/hooks/use-permissions'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import type { ProjectSettings, UpdateSettingsData } from '@/entities/settings'

export default function ProjectSettingsPage() {
  const authContext = useAuthContext()
  const { user: authUser, isAuthenticated, isInitialized } = authContext
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('security')
  const [refreshing, setRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localSettings, setLocalSettings] = useState<ProjectSettings | null>(null)
  const [showAesKey, setShowAesKey] = useState(false)

  const canManageSettings = hasPermission('system.manage')

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['project-settings'],
    queryFn: getProjectSettings,
    enabled: canManageSettings && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSettingsData) => updateProjectSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-settings'] })
      toast.success('Settings updated successfully')
      setIsSaving(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update settings')
      setIsSaving(false)
    },
  })

  const regenerateKeysMutation = useMutation({
    mutationFn: (action: 'aes') => regenerateKeys(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-settings'] })
      toast.success('Encryption keys regenerated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to regenerate keys')
    },
  })

  const regenerateMasterKeyMutation = useMutation({
    mutationFn: regenerateMasterKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-settings'] })
      toast.success(data.message || 'Master key regenerated successfully', {
        description: data.warning,
      })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to regenerate master key')
    },
  })

  React.useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } catch (error) {
      // Error refreshing
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleSave = useCallback(() => {
    if (!localSettings) return
    
    setIsSaving(true)
    const updateData: UpdateSettingsData = {
      security: localSettings.security,
      security_features: localSettings.security_features,
      encryption: localSettings.encryption,
      offline_auth: localSettings.offline_auth,
      appearance: localSettings.appearance,
    }
    
    updateMutation.mutate(updateData)
  }, [localSettings, updateMutation])

  const handleInputChange = useCallback((section: keyof ProjectSettings, field: string, value: any) => {
    if (!localSettings) return
    
    // Handle top-level fields like project_unique_id
    if (section === 'project_unique_id' || !(section in localSettings) || typeof localSettings[section] !== 'object') {
      setLocalSettings({
        ...localSettings,
        [section]: value,
      })
      return
    }
    
    setLocalSettings({
      ...localSettings,
      [section]: {
        ...localSettings[section],
        [field]: value,
      },
    })
  }, [localSettings])

  const availableTabs = useMemo(() => {
    return [
      {
        value: 'security',
        label: 'Security',
        icon: Shield
      },
      {
        value: 'encryption',
        label: 'Encryption',
        icon: Lock
      },
      {
        value: 'keys',
        label: 'Keys',
        icon: Key
      }
    ]
  }, [])

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !authUser) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={authUser}
        message="You need to be logged in to view project settings."
        useCard={true}
      />
    )
  }

  if (!canManageSettings) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={authUser}
        message="You don't have permission to manage project settings."
        useCard={true}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !settings || !localSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {error ? 'Failed to load settings' : 'No settings available'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  Project Settings
                </h1>
                <div className="flex items-center gap-2 mt-1 xs:mt-1.5 sm:mt-2">
                  <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground leading-snug">
                    Manage your project configuration and security settings
                  </p>
                  {settings?.project_unique_id && (
                    <>
                      <span className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground">•</span>
                      <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground leading-snug">
                        Unique ID: <span className="font-mono font-semibold text-foreground">{settings.project_unique_id}</span>
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleRefresh} 
                  disabled={refreshing}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 text-xs"
                >
                  {isSaving ? (
                    <>
                      <Spinner className="h-3 w-3 mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Settings Content */}
          <div className="px-4 lg:px-6 flex-1 flex flex-col overflow-hidden">
            {availableTabs.length > 0 && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="relative mb-4">
                  <TabsList 
                    className="grid w-full h-12 bg-muted/30 border border-border rounded-lg p-1" 
                    style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}
                  >
                    {availableTabs.map((tab) => {
                      const Icon = tab.icon
                      return (
                        <TabsTrigger 
                          key={tab.value}
                          value={tab.value} 
                          className="flex items-center justify-center gap-2 text-xs sm:text-sm"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </div>

                <TabsContent value="security" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Security Settings</CardTitle>
                      <CardDescription className="text-xs">
                        Configure basic security parameters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="min_password_length" className="text-xs">
                            Minimum Password Length
                          </Label>
                          <Input
                            id="min_password_length"
                            type="number"
                            min="4"
                            max="128"
                            value={localSettings.security.min_password_length}
                            onChange={(e) => handleInputChange('security', 'min_password_length', parseInt(e.target.value) || 8)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max_login_attempts" className="text-xs">
                            Max Login Attempts
                          </Label>
                          <Input
                            id="max_login_attempts"
                            type="number"
                            min="1"
                            max="20"
                            value={localSettings.security.max_login_attempts}
                            onChange={(e) => handleInputChange('security', 'max_login_attempts', parseInt(e.target.value) || 5)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ip_block_duration" className="text-xs">
                            IP Block Duration (minutes)
                          </Label>
                          <Input
                            id="ip_block_duration"
                            type="number"
                            min="1"
                            value={localSettings.security.ip_block_duration_minutes}
                            onChange={(e) => handleInputChange('security', 'ip_block_duration_minutes', parseInt(e.target.value) || 15)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max_sessions" className="text-xs">
                            Max Sessions Per User
                          </Label>
                          <Input
                            id="max_sessions"
                            type="number"
                            min="1"
                            max="50"
                            value={localSettings.security.max_sessions_per_user}
                            onChange={(e) => handleInputChange('security', 'max_sessions_per_user', parseInt(e.target.value) || 5)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="log_retention" className="text-xs">
                            Log Retention (days)
                          </Label>
                          <Input
                            id="log_retention"
                            type="number"
                            min="1"
                            value={localSettings.security.log_retention_days}
                            onChange={(e) => handleInputChange('security', 'log_retention_days', parseInt(e.target.value) || 60)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="security_log_level" className="text-xs">
                            Security Log Level
                          </Label>
                          <Input
                            id="security_log_level"
                            value={localSettings.security.security_log_level}
                            onChange={(e) => handleInputChange('security', 'security_log_level', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Security Features</CardTitle>
                      <CardDescription className="text-xs">
                        Enable or disable security features
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="two_factor_auth" className="text-xs">
                            Two-Factor Authentication Required
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Require 2FA for all users
                          </p>
                        </div>
                        <Switch
                          id="two_factor_auth"
                          checked={localSettings.security_features.two_factor_auth_required}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'two_factor_auth_required', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="password_complexity" className="text-xs">
                            Password Complexity Required
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Enforce complex password rules
                          </p>
                        </div>
                        <Switch
                          id="password_complexity"
                          checked={localSettings.security_features.password_complexity_required}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'password_complexity_required', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="session_fingerprinting" className="text-xs">
                            Session Fingerprinting
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Track device fingerprints
                          </p>
                        </div>
                        <Switch
                          id="session_fingerprinting"
                          checked={localSettings.security_features.session_fingerprinting}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'session_fingerprinting', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="ip_whitelist_enabled" className="text-xs">
                            IP Whitelist
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Restrict access to specific IPs
                          </p>
                        </div>
                        <Switch
                          id="ip_whitelist_enabled"
                          checked={localSettings.security_features.ip_whitelist_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'ip_whitelist_enabled', checked)}
                        />
                      </div>
                      {localSettings.security_features.ip_whitelist_enabled && (
                        <div className="space-y-2">
                          <Label htmlFor="ip_whitelist" className="text-xs">
                            IP Whitelist (one per line)
                          </Label>
                          <Textarea
                            id="ip_whitelist"
                            value={localSettings.security_features.ip_whitelist || ''}
                            onChange={(e) => handleInputChange('security_features', 'ip_whitelist', e.target.value)}
                            className="min-h-[100px] text-xs"
                            placeholder="192.168.1.1&#10;10.0.0.1"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="rate_limiting" className="text-xs">
                            Rate Limiting
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Limit request rate per minute
                          </p>
                        </div>
                        <Switch
                          id="rate_limiting"
                          checked={localSettings.security_features.rate_limiting_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'rate_limiting_enabled', checked)}
                        />
                      </div>
                      {localSettings.security_features.rate_limiting_enabled && (
                        <div className="space-y-2">
                          <Label htmlFor="rate_limit_requests" className="text-xs">
                            Requests Per Minute
                          </Label>
                          <Input
                            id="rate_limit_requests"
                            type="number"
                            min="1"
                            value={localSettings.security_features.rate_limit_requests_per_minute}
                            onChange={(e) => handleInputChange('security_features', 'rate_limit_requests_per_minute', parseInt(e.target.value) || 60)}
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="vpn_blocking" className="text-xs">
                            VPN Blocking
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Block VPN connections
                          </p>
                        </div>
                        <Switch
                          id="vpn_blocking"
                          checked={localSettings.security_features.vpn_blocking_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'vpn_blocking_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="security_logging" className="text-xs">
                            Security Logging
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Log security events
                          </p>
                        </div>
                        <Switch
                          id="security_logging"
                          checked={localSettings.security_features.security_logging_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'security_logging_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="suspicious_activity" className="text-xs">
                            Suspicious Activity Check
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Monitor for suspicious behavior
                          </p>
                        </div>
                        <Switch
                          id="suspicious_activity"
                          checked={localSettings.security_features.suspicious_activity_check_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'suspicious_activity_check_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="session_limiting" className="text-xs">
                            Session Limiting
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Enforce session limits
                          </p>
                        </div>
                        <Switch
                          id="session_limiting"
                          checked={localSettings.security_features.session_limiting_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'session_limiting_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="auto_log_cleanup" className="text-xs">
                            Auto Log Cleanup
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Automatically clean old logs
                          </p>
                        </div>
                        <Switch
                          id="auto_log_cleanup"
                          checked={localSettings.security_features.auto_log_cleanup_enabled}
                          onCheckedChange={(checked) => handleInputChange('security_features', 'auto_log_cleanup_enabled', checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="encryption" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Encryption Settings</CardTitle>
                      <CardDescription className="text-xs">
                        Configure data encryption
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="encryption_enabled" className="text-xs">
                            Encryption Enabled
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Enable data encryption
                          </p>
                        </div>
                        <Switch
                          id="encryption_enabled"
                          checked={localSettings.encryption.encryption_enabled}
                          onCheckedChange={(checked) => handleInputChange('encryption', 'encryption_enabled', checked)}
                        />
                      </div>
                      {localSettings.encryption.encryption_enabled && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="encryption_algorithm" className="text-xs">
                              Encryption Algorithm
                            </Label>
                            <Input
                              id="encryption_algorithm"
                              value={localSettings.encryption.encryption_algorithm}
                              onChange={(e) => handleInputChange('encryption', 'encryption_algorithm', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="key_rotation_days" className="text-xs">
                              Key Rotation (days)
                            </Label>
                            <Input
                              id="key_rotation_days"
                              type="number"
                              min="1"
                              value={localSettings.encryption.key_rotation_days}
                              onChange={(e) => handleInputChange('encryption', 'key_rotation_days', parseInt(e.target.value) || 90)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Offline Authentication</CardTitle>
                      <CardDescription className="text-xs">
                        Configure offline authentication settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="offline_auth_enabled" className="text-xs">
                            Offline Auth Enabled
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Allow offline authentication
                          </p>
                        </div>
                        <Switch
                          id="offline_auth_enabled"
                          checked={localSettings.offline_auth.offline_auth_enabled}
                          onCheckedChange={(checked) => handleInputChange('offline_auth', 'offline_auth_enabled', checked)}
                        />
                      </div>
                      {localSettings.offline_auth.offline_auth_enabled && (
                        <div className="space-y-2">
                          <Label htmlFor="offline_ticket_expiration" className="text-xs">
                            Ticket Expiration (hours)
                          </Label>
                          <Input
                            id="offline_ticket_expiration"
                            type="number"
                            min="1"
                            value={localSettings.offline_auth.offline_ticket_expiration_hours}
                            onChange={(e) => handleInputChange('offline_auth', 'offline_ticket_expiration_hours', parseInt(e.target.value) || 12)}
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="keys" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Encryption Keys</CardTitle>
                      <CardDescription className="text-xs">
                        Manage encryption keys for your project
                        {settings?.project_unique_id && (
                          <span className="ml-2 font-mono text-foreground">(Unique ID: {settings.project_unique_id})</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">AES Key</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showAesKey ? "text" : "password"}
                              value={localSettings.encryption_keys.aes_key || ''}
                              readOnly
                              className="h-8 text-xs font-mono pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowAesKey(!showAesKey)}
                              className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                              aria-label={showAesKey ? "Hide AES key" : "Show AES key"}
                            >
                              {showAesKey ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateKeysMutation.mutate('aes')}
                            disabled={regenerateKeysMutation.isPending}
                            className="h-8 text-xs"
                          >
                            {regenerateKeysMutation.isPending ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              'Regenerate'
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateMasterKeyMutation.mutate()}
                          disabled={regenerateMasterKeyMutation.isPending}
                          className="h-8 text-xs"
                        >
                          {regenerateMasterKeyMutation.isPending ? (
                            <>
                              <Spinner className="h-3 w-3 mr-2" />
                              Regenerating...
                            </>
                          ) : (
                            'Regenerate Master Key'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

