import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Loader2 } from 'lucide-react'

interface ProfileSecurityTabProps {
  passwordData: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }
  isPasswordChanging: boolean
  onPasswordChange: (field: string, value: string) => void
  onChangePassword: () => void
}

export function ProfileSecurityTab({
  passwordData,
  isPasswordChanging,
  onPasswordChange,
  onChangePassword,
}: ProfileSecurityTabProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Manage your password and security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            placeholder="Enter your current password"
            value={passwordData.currentPassword}
            onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="Enter your new password"
            value={passwordData.newPassword}
            onChange={(e) => onPasswordChange('newPassword', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            value={passwordData.confirmPassword}
            onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          onClick={onChangePassword}
          disabled={
            isPasswordChanging ||
            !passwordData.currentPassword ||
            !passwordData.newPassword ||
            !passwordData.confirmPassword
          }
        >
          {isPasswordChanging ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Changing...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

