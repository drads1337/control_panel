"use client"

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
  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isPasswordChanging && onChangePassword) {
      onChangePassword()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isPasswordChanging) {
      e.preventDefault()
      e.stopPropagation()
      onChangePassword()
    }
  }

  return (
    <Card className="border rounded-lg bg-background shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/30">
        <div>
          <CardTitle className="text-base sm:text-lg font-semibold">Security</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage your password and security settings</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            placeholder="Enter your current password"
            value={passwordData.currentPassword}
            onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPasswordChanging}
            className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-xs">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="Enter your new password"
            value={passwordData.newPassword}
            onChange={(e) => onPasswordChange('newPassword', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPasswordChanging}
            className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
          />
          <p className="text-[10px] text-muted-foreground">Minimum 6 characters</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            value={passwordData.confirmPassword}
            onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPasswordChanging}
            className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            className="w-full md:w-auto md:ml-auto md:block h-8 text-xs"
            onClick={handleButtonClick}
            disabled={
              isPasswordChanging ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
          >
            {isPasswordChanging ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <Key className="h-3 w-3 mr-2" />
                Change Password
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

