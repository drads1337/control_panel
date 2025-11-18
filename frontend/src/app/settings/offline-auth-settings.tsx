import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { WifiOff, Clock } from 'lucide-react'
import { useSettingsQuery } from '@/hooks/use-settings-query'

export default function OfflineAuthSettings() {
  const { settings, saveSettings, isSaving } = useSettingsQuery()
  const [offlineAuthEnabled, setOfflineAuthEnabled] = useState(
    settings?.offline_auth?.offline_auth_enabled ?? false
  )
  const [expirationHours, setExpirationHours] = useState(
    settings?.offline_auth?.offline_ticket_expiration_hours ?? 12
  )

  useEffect(() => {
    if (settings?.offline_auth) {
      setOfflineAuthEnabled(settings.offline_auth.offline_auth_enabled ?? false)
      setExpirationHours(settings.offline_auth.offline_ticket_expiration_hours ?? 12)
    }

  }, [])

  const handleEnabledChange = useCallback((checked: boolean) => {
    setOfflineAuthEnabled(checked)

    saveSettings({
      offline_auth: {
        offline_auth_enabled: checked,
        offline_ticket_expiration_hours: expirationHours,
      },
    }).catch(() => {

      setOfflineAuthEnabled(!checked)
    })
  }, [saveSettings, expirationHours])

  useEffect(() => {
    if (!offlineAuthEnabled) return

    if (settings?.offline_auth?.offline_ticket_expiration_hours === expirationHours) {
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        await saveSettings({
          offline_auth: {
            offline_auth_enabled: offlineAuthEnabled,
            offline_ticket_expiration_hours: Math.max(1, Math.min(168, expirationHours)),
          },
        })
      } catch (error) {

        if (settings?.offline_auth?.offline_ticket_expiration_hours) {
          setExpirationHours(settings.offline_auth.offline_ticket_expiration_hours)
        }
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [expirationHours, saveSettings, settings, offlineAuthEnabled])

  const handleExpirationChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue)) {
      setExpirationHours(Math.max(1, Math.min(168, numValue)))
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Offline Authentication</CardTitle>
        </div>
        <CardDescription>
          Cached tickets for offline access
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="offline-auth-enabled" className="text-sm font-medium">
            Enable
          </Label>
          <Switch
            id="offline-auth-enabled"
            checked={offlineAuthEnabled}
            onCheckedChange={handleEnabledChange}
            disabled={isSaving}
          />
        </div>

        {offlineAuthEnabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="expiration-hours" className="text-sm font-medium">
                Expiration (hours)
              </Label>
            </div>
            <Input
              id="expiration-hours"
              type="number"
              min="1"
              max="168"
              value={expirationHours}
              onChange={(e) => handleExpirationChange(e.target.value)}
              disabled={isSaving}
              className="max-w-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
