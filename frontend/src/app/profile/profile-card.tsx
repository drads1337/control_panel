import React, { useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Mail, Camera, Loader2 } from 'lucide-react'
import { getPrimaryRole } from '@/lib/rbac-utils'
import { getApiUrl } from '@/lib/utils'
import type { User } from '@/entities/user'

interface ProfileCardProps {
  user: User | null | undefined
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

  const triggerFileInput = () => {
    fileInputRef.current?.click()
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

  return (
    <Card className="@container/card border shadow-sm">
      <CardContent className="p-8">
        <div className="text-center">
          {}
          <div className="relative inline-block mb-6">
            <Avatar className="h-28 w-28 bg-muted border-2 border-border">
              <AvatarImage
                src={user?.avatar ? getApiUrl(`/api/users/avatar/${user.avatar}`) : undefined}
                alt="User avatar"
              />
              <AvatarFallback className="text-3xl font-bold text-foreground bg-muted">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            {}
            {isAvatarUploading && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {}
            <Button
              size="sm"
              variant="outline"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full p-0 border-2 border-background shadow-sm bg-background hover:bg-muted"
              onClick={triggerFileInput}
              disabled={isAvatarUploading}
              title="Change avatar"
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

          {}
          <h3 className="text-2xl font-bold text-foreground mb-2">{getFullName()}</h3>

          {}
          <p className="text-muted-foreground mb-4 text-lg">@{profileData.username}</p>

          {}
          <Badge className="mb-6 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-md">
            {(() => {
              const primaryRole = getPrimaryRole(user)
              return primaryRole
                ? primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
                : 'User'
            })()}
          </Badge>

          {}
          <div className="space-y-4 text-left">
            {profileData.email && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{profileData.email}</span>
              </div>
            )}

            {profileData.bio && (
              <div className="text-sm text-muted-foreground text-center bg-muted p-3 rounded-lg border border-border">
                {profileData.bio}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
