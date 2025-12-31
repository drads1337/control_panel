"use client"

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Mail, Camera, Loader2 } from 'lucide-react'
import { getPrimaryRole } from '@/shared/lib/rbac'
import { cn } from '@/lib/utils'

interface ProfileCardProps {
  user: any | null | undefined
  profileData: {
    username: string
    firstName: string
    lastName: string
    email: string
    bio: string
  }
  isAvatarUploading: boolean
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProfileCard({
  user,
  profileData,
  isAvatarUploading,
  onAvatarUpload,
}: ProfileCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarKey, setAvatarKey] = useState(() => Date.now())

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const getFullName = () => {
    const firstName = profileData.firstName.trim()
    const lastName = profileData.lastName.trim()

    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    } else if (firstName) {
      return firstName
    } else if (lastName) {
      return lastName
    } else {
      return profileData.username
    }
  }

  const getInitials = () => {
    const firstName = profileData.firstName.trim()
    const lastName = profileData.lastName.trim()

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase()
    } else if (lastName) {
      return lastName.charAt(0).toUpperCase()
    } else {
      return profileData.username.charAt(0).toUpperCase()
    }
  }

  const avatarUrl = useMemo(() => {
    if (!user?.avatar) {
      return undefined
    }
    
    // Get API base URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${baseUrl}/uploads/avatars/${user.avatar}?t=${avatarKey}`
    
    return url
  }, [user?.avatar, avatarKey])

  return (
    <Card className="border rounded-lg bg-background shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="text-center">
          {/* Avatar */}
          <div className="relative inline-block mb-4 sm:mb-6">
            <Avatar 
              className="h-24 w-24 sm:h-28 sm:w-28 bg-muted border-2 border-border" 
              key={`avatar-container-${user?.avatar || 'no-avatar'}-${avatarKey}`}
            >
              <AvatarImage
                src={avatarUrl || undefined}
                alt="User avatar"
                key={`avatar-img-${user?.avatar || 'no-avatar'}-${avatarKey}`}
                onError={() => {
                  setAvatarKey(Date.now())
                }}
              />
              <AvatarFallback className="text-2xl sm:text-3xl font-bold text-foreground bg-muted">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            {/* Uploading overlay */}
            {isAvatarUploading && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center z-20 pointer-events-none">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Camera button */}
            <Button
              size="sm"
              variant="outline"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full p-0 border-2 border-background shadow-sm bg-background hover:bg-muted z-50 cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                triggerFileInput()
              }}
              disabled={isAvatarUploading}
              title="Change avatar"
              type="button"
            >
              <Camera className="h-4 w-4 text-foreground" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={onAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Name */}
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">{getFullName()}</h3>

          {/* Username */}
          <p className="text-muted-foreground mb-4 sm:mb-6 text-base sm:text-lg">@{profileData.username}</p>

          {/* Role Badge */}
          <Badge className="mb-6 bg-primary text-primary-foreground px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md">
            {(() => {
              const primaryRole = getPrimaryRole(user ?? null)
              return primaryRole
                ? primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
                : 'User'
            })()}
          </Badge>

          {/* Email and Bio */}
          <div className="space-y-4 text-left">
            {profileData.email && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{profileData.email}</span>
              </div>
            )}

            {profileData.bio && (
              <div className="text-sm text-muted-foreground text-center bg-muted/50 p-3 rounded-lg border border-border">
                {profileData.bio}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

