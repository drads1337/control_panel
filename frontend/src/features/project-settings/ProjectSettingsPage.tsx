"use client"

import React, { useState, useCallback } from 'react'
import { RefreshCw, Eye, EyeOff, Palette, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
      encryption: localSettings.encryption,
      offline_auth: localSettings.offline_auth,
      appearance: localSettings.appearance || {},
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
            <div className="space-y-4">
              {/* Project Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Project Information
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Information about your project status and subscription
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Project Status</Label>
                      <div className="flex items-center gap-2">
                        {settings.project_is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs font-medium capitalize">
                          {settings.project_status || 'unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Subscription Status</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">
                          {settings.project_subscription_status || 'free'}
                        </span>
                      </div>
                    </div>
                    {settings.project_subscription_expires_at && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Expires At</Label>
                          <p className="text-xs">
                            {new Date(settings.project_subscription_expires_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Days Remaining</Label>
                          <div className="flex items-center gap-2">
                            {settings.project_days_until_expiry !== null && settings.project_days_until_expiry !== undefined && settings.project_days_until_expiry <= 3 ? (
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            ) : settings.project_days_until_expiry !== null && settings.project_days_until_expiry !== undefined && settings.project_days_until_expiry <= 0 ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <span className={`text-xs font-medium ${
                              settings.project_days_until_expiry !== null && settings.project_days_until_expiry !== undefined && settings.project_days_until_expiry <= 3
                                ? 'text-yellow-600 dark:text-yellow-500'
                                : settings.project_days_until_expiry !== null && settings.project_days_until_expiry !== undefined && settings.project_days_until_expiry <= 0
                                ? 'text-red-600 dark:text-red-500'
                                : ''
                            }`}>
                              {settings.project_days_until_expiry !== null && settings.project_days_until_expiry !== undefined
                                ? `${settings.project_days_until_expiry} ${settings.project_days_until_expiry === 1 ? 'day' : 'days'}`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {!settings.project_subscription_expires_at && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Subscription</Label>
                        <p className="text-xs text-muted-foreground">No expiration date set</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Appearance Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Customize the appearance and colors of your project
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color" className="text-xs">
                      Primary Color
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Input
                          id="primary_color"
                          type="color"
                          value={localSettings.appearance?.primaryColor || '#134e4a'}
                          onChange={(e) => {
                            const color = e.target.value
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                primaryColor: color
                              }
                            })
                          }}
                          className="h-10 w-20 cursor-pointer border-0 p-1"
                          style={{ 
                            backgroundColor: localSettings.appearance?.primaryColor || '#134e4a',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={localSettings.appearance?.primaryColor || '#134e4a'}
                          onChange={(e) => {
                            let color = e.target.value
                            // Allow partial input, but validate format
                            if (color === '' || /^#[0-9A-Fa-f]{0,6}$/.test(color)) {
                              // If it starts with # and has valid hex chars, allow it
                              if (!color.startsWith('#')) {
                                color = '#' + color
                              }
                              // Limit to 7 chars (# + 6 hex)
                              if (color.length <= 7) {
                                setLocalSettings({
                                  ...localSettings,
                                  appearance: {
                                    ...(localSettings.appearance || {}),
                                    primaryColor: color || '#134e4a'
                                  }
                                })
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // Validate and fix on blur
                            let color = e.target.value
                            if (!color.startsWith('#')) {
                              color = '#' + color
                            }
                            // If not valid hex, reset to default or current
                            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                              color = localSettings.appearance?.primaryColor || '#134e4a'
                            }
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                primaryColor: color
                              }
                            })
                          }}
                          placeholder="#134e4a"
                          className="h-8 text-xs font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Choose a primary color for your project interface
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary_color" className="text-xs">
                      Secondary Color
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Input
                          id="secondary_color"
                          type="color"
                          value={localSettings.appearance?.secondaryColor || '#f1f5f9'}
                          onChange={(e) => {
                            const color = e.target.value
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                secondaryColor: color
                              }
                            })
                          }}
                          className="h-10 w-20 cursor-pointer border-0 p-1"
                          style={{ 
                            backgroundColor: localSettings.appearance?.secondaryColor || '#f1f5f9',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={localSettings.appearance?.secondaryColor || '#f1f5f9'}
                          onChange={(e) => {
                            let color = e.target.value
                            if (color === '' || /^#[0-9A-Fa-f]{0,6}$/.test(color)) {
                              if (!color.startsWith('#')) {
                                color = '#' + color
                              }
                              if (color.length <= 7) {
                                setLocalSettings({
                                  ...localSettings,
                                  appearance: {
                                    ...(localSettings.appearance || {}),
                                    secondaryColor: color || '#f1f5f9'
                                  }
                                })
                              }
                            }
                          }}
                          onBlur={(e) => {
                            let color = e.target.value
                            if (!color.startsWith('#')) {
                              color = '#' + color
                            }
                            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                              color = localSettings.appearance?.secondaryColor || '#f1f5f9'
                            }
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                secondaryColor: color
                              }
                            })
                          }}
                          placeholder="#f1f5f9"
                          className="h-8 text-xs font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Choose a secondary color for your project interface
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accent_color" className="text-xs">
                      Accent Color
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Input
                          id="accent_color"
                          type="color"
                          value={localSettings.appearance?.accentColor || '#3b82f6'}
                          onChange={(e) => {
                            const color = e.target.value
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                accentColor: color
                              }
                            })
                          }}
                          className="h-10 w-20 cursor-pointer border-0 p-1"
                          style={{ 
                            backgroundColor: localSettings.appearance?.accentColor || '#3b82f6',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={localSettings.appearance?.accentColor || '#3b82f6'}
                          onChange={(e) => {
                            let color = e.target.value
                            if (color === '' || /^#[0-9A-Fa-f]{0,6}$/.test(color)) {
                              if (!color.startsWith('#')) {
                                color = '#' + color
                              }
                              if (color.length <= 7) {
                                setLocalSettings({
                                  ...localSettings,
                                  appearance: {
                                    ...(localSettings.appearance || {}),
                                    accentColor: color || '#3b82f6'
                                  }
                                })
                              }
                            }
                          }}
                          onBlur={(e) => {
                            let color = e.target.value
                            if (!color.startsWith('#')) {
                              color = '#' + color
                            }
                            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                              color = localSettings.appearance?.accentColor || '#3b82f6'
                            }
                            setLocalSettings({
                              ...localSettings,
                              appearance: {
                                ...(localSettings.appearance || {}),
                                accentColor: color
                              }
                            })
                          }}
                          placeholder="#3b82f6"
                          className="h-8 text-xs font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Choose an accent color for highlights and accents
                    </p>
                  </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

