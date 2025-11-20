import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Mail, Camera, Loader2 } from 'lucide-react'
import { getPrimaryRole } from '@/lib/rbac-utils'
import { getApiUrl, getApiBaseUrl } from '@/lib/utils'
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
  const [avatarKey, setAvatarKey] = useState(() => Date.now())
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null)

  // Загружаем аватар через fetch и создаем blob URL
  useEffect(() => {
    if (user?.avatar) {
      // Очищаем предыдущий blob URL
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
        setAvatarBlobUrl(null)
      }
    
      const newKey = Date.now()
      setAvatarKey(newKey)
      
      const baseUrl = getApiBaseUrl() || window.location.origin
      const avatarUrl = `${baseUrl}/uploads/avatars/${user.avatar}?t=${newKey}`
      
      const fetchStartTime = Date.now()
      fetch(avatarUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'image/*'
        }
      })
        .then(async response => {
          const fetchDuration = Date.now() - fetchStartTime
          const responseHeaders: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value
          })
          
          if (!response.ok) {
            // Try to get error message from response
            let errorMessage = response.statusText
            let errorBody = null
            
            try {
              const clonedResponse = response.clone()
              const contentType = clonedResponse.headers.get('content-type')
              
              if (contentType && contentType.includes('application/json')) {
                errorBody = await clonedResponse.json()
                errorMessage = errorBody.error || errorBody.message || errorMessage
              } else {
                errorBody = await clonedResponse.text()
              }
            } catch (e) {
              // Failed to parse error response
            }
            
            // Handle 404 gracefully - avatar file doesn't exist
            if (response.status === 404) {
              setAvatarBlobUrl(null)
              return null
            }
            // For other errors, still log but don't throw
            setAvatarBlobUrl(null)
            return null
          }
          
          return response.blob()
        })
        .then(blob => {
          if (!blob) {
            // 404 or other error was handled above
            return
          }
          
          const blobUrl = URL.createObjectURL(blob)
          setAvatarBlobUrl(blobUrl)
        })
        .catch(error => {
          setAvatarBlobUrl(null)
        })
    } else {
      // Очищаем blob URL если аватара нет
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
        setAvatarBlobUrl(null)
      }
    }
    
    // Cleanup при размонтировании или изменении аватара
    return () => {
      // Cleanup будет выполнен в следующем эффекте
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.avatar])
  
  // Cleanup blob URL при размонтировании
  useEffect(() => {
    return () => {
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
      }
    }
  }, [avatarBlobUrl])

  // Используем blob URL если он доступен, иначе формируем обычный URL
  const avatarUrl = useMemo(() => {
    if (avatarBlobUrl) {
      return avatarBlobUrl
    }
    
    if (!user?.avatar) {
      return undefined
    }
    
    // Fallback на обычный URL - используем прямой путь к статическим файлам
    const baseUrl = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')
    const url = `${baseUrl}/uploads/avatars/${user.avatar}?t=${avatarKey}`
    
    return url
  }, [avatarBlobUrl, user?.avatar, avatarKey])

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

  return (
    <Card className="@container/card border shadow-sm">
      <CardContent className="p-8">
        <div className="text-center">
          {}
          <div className="relative inline-block mb-6">
            <Avatar 
              className="h-28 w-28 bg-muted border-2 border-border" 
              key={`avatar-container-${user?.avatar || 'no-avatar'}-${avatarKey}`}
            >
              <AvatarImage
                src={avatarUrl || undefined}
                alt="User avatar"
                key={`avatar-img-${user?.avatar || 'no-avatar'}-${avatarKey}-${avatarBlobUrl ? 'blob' : 'url'}`}
                onError={(e) => {
                  // Avatar image load error
                }}
                onLoad={(e) => {
                  // Avatar image loaded successfully
                }}
                onLoadStart={() => {
                  // Avatar image load started
                }}
              />
              <AvatarFallback className="text-3xl font-bold text-foreground bg-muted">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            {}
            {isAvatarUploading && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center z-20 pointer-events-none">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {}
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
              onChange={(e) => {
                onAvatarUpload(e)
              }}
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
              const primaryRole = getPrimaryRole(user ?? null)
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
