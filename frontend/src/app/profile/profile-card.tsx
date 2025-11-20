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
      console.log('🔍 [AVATAR DEBUG] Avatar changed in ProfileCard:', {
        avatar: user.avatar,
        userId: user.id,
        previousBlobUrl: avatarBlobUrl
      })
      
      // Очищаем предыдущий blob URL
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
        setAvatarBlobUrl(null)
      }
      
      // Генерируем новый ключ для принудительного обновления компонента
      const newKey = Date.now()
      setAvatarKey(newKey)
      
      // Загружаем изображение через fetch с credentials
      // Используем прямой путь к статическим файлам, не через API
      const baseUrl = getApiBaseUrl() || window.location.origin
      const avatarUrl = `${baseUrl}/uploads/avatars/${user.avatar}?t=${newKey}`
      
      console.log('🔍 [AVATAR DEBUG] Starting avatar load:', {
        avatar: user.avatar,
        baseUrl,
        windowOrigin: window.location.origin,
        apiBaseUrl: getApiBaseUrl(),
        fullUrl: avatarUrl,
        timestamp: newKey,
        cookies: document.cookie ? 'present' : 'missing'
      })
      
      console.log('🔍 [AVATAR DEBUG] Fetch request details:', {
        url: avatarUrl,
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'image/*'
        }
      })
      
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
          
          console.log('🔍 [AVATAR DEBUG] Fetch response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            type: response.type,
            redirected: response.redirected,
            url: response.url,
            headers: responseHeaders,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
            duration: `${fetchDuration}ms`
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
                console.log('🔍 [AVATAR DEBUG] Error response body (text):', errorBody)
              }
            } catch (e) {
              console.warn('🔍 [AVATAR DEBUG] Failed to parse error response:', e)
            }
            
            console.error('❌ [AVATAR DEBUG] Avatar fetch failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorMessage,
              errorBody,
              url: avatarUrl,
              finalUrl: response.url,
              redirected: response.redirected,
              headers: responseHeaders
            })
            
            // Handle 404 gracefully - avatar file doesn't exist
            if (response.status === 404) {
              console.warn('⚠️ [AVATAR DEBUG] Avatar file not found (404):', {
                requestedUrl: avatarUrl,
                finalUrl: response.url,
                error: errorMessage,
                errorBody,
                avatarFilename: user.avatar
              })
              setAvatarBlobUrl(null)
              return null
            }
            // For other errors, still log but don't throw
            console.warn(`⚠️ [AVATAR DEBUG] Failed to load avatar: ${response.status} ${errorMessage}`)
            setAvatarBlobUrl(null)
            return null
          }
          
          console.log('✅ [AVATAR DEBUG] Response OK, converting to blob...')
          return response.blob()
        })
        .then(blob => {
          if (!blob) {
            // 404 or other error was handled above
            console.log('🔍 [AVATAR DEBUG] No blob received (404 or error handled)')
            return
          }
          
          console.log('🔍 [AVATAR DEBUG] Blob created successfully:', {
            size: blob.size,
            type: blob.type,
            sizeKB: `${(blob.size / 1024).toFixed(2)} KB`
          })
          
          const blobUrl = URL.createObjectURL(blob)
          setAvatarBlobUrl(blobUrl)
          console.log('✅ [AVATAR DEBUG] Avatar blob URL created:', {
            blobUrl,
            blobSize: blob.size,
            blobType: blob.type
          })
        })
        .catch(error => {
          console.error('❌ [AVATAR DEBUG] Avatar fetch exception:', {
            error,
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
            url: avatarUrl,
            timestamp: new Date().toISOString()
          })
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
      console.log('🔍 [AVATAR DEBUG] Using blob URL for avatar:', {
        blobUrl: avatarBlobUrl,
        hasBlob: !!avatarBlobUrl
      })
      return avatarBlobUrl
    }
    
    if (!user?.avatar) {
      console.log('🔍 [AVATAR DEBUG] No avatar filename, returning undefined')
      return undefined
    }
    
    // Fallback на обычный URL - используем прямой путь к статическим файлам
    const baseUrl = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')
    const url = `${baseUrl}/uploads/avatars/${user.avatar}?t=${avatarKey}`
    
    console.log('🔍 [AVATAR DEBUG] Using fallback URL for avatar:', {
      url,
      baseUrl,
      avatar: user.avatar,
      key: avatarKey,
      hasBlob: false
    })
    return url
  }, [avatarBlobUrl, user?.avatar, avatarKey])

  // Отладочная информация
  useEffect(() => {
    console.log('🔍 [AVATAR DEBUG] ProfileCard state update:', { 
      hasUser: !!user, 
      userId: user?.id,
      avatar: user?.avatar,
      isUploading: isAvatarUploading,
      avatarUrl,
      avatarKey,
      hasBlobUrl: !!avatarBlobUrl,
      blobUrl: avatarBlobUrl,
      timestamp: new Date().toISOString()
    })
  }, [user, isAvatarUploading, avatarUrl, avatarKey, avatarBlobUrl])

  const triggerFileInput = () => {
    console.log('triggerFileInput called', { 
      hasRef: !!fileInputRef.current,
      refValue: fileInputRef.current 
    })
    if (fileInputRef.current) {
      fileInputRef.current.click()
      console.log('File input clicked')
    } else {
      console.error('File input ref is null!')
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
                  const target = e.currentTarget as HTMLImageElement
                  console.error('❌ [AVATAR DEBUG] Avatar image load error in <img> tag:', {
                    error: e,
                    src: target.src,
                    naturalWidth: target.naturalWidth,
                    naturalHeight: target.naturalHeight,
                    complete: target.complete,
                    avatarUrl,
                    userAvatar: user?.avatar,
                    avatarKey,
                    isBlob: avatarUrl?.startsWith('blob:'),
                    imageElement: {
                      width: target.width,
                      height: target.height,
                      currentSrc: target.currentSrc,
                      loading: target.loading
                    }
                  })
                  
                  // Попробуем загрузить изображение через fetch для проверки
                  if (avatarUrl) {
                    console.log('🔍 [AVATAR DEBUG] Re-checking avatar URL via fetch after <img> error:', avatarUrl)
                    const checkStartTime = Date.now()
                    fetch(avatarUrl, { 
                      method: 'GET',
                      credentials: 'include',
                      headers: {
                        'Accept': 'image/*'
                      }
                    })
                      .then(async response => {
                        const checkDuration = Date.now() - checkStartTime
                        const headers: Record<string, string> = {}
                        response.headers.forEach((value, key) => {
                          headers[key] = value
                        })
                        
                        console.log('🔍 [AVATAR DEBUG] Re-check fetch response:', {
                          status: response.status,
                          statusText: response.statusText,
                          ok: response.ok,
                          url: response.url,
                          redirected: response.redirected,
                          headers,
                          duration: `${checkDuration}ms`
                        })
                        
                        if (!response.ok) {
                          try {
                            const errorText = await response.text()
                            console.error('❌ [AVATAR DEBUG] Re-check error response body:', {
                              status: response.status,
                              body: errorText,
                              contentType: response.headers.get('content-type')
                            })
                          } catch (err) {
                            console.error('❌ [AVATAR DEBUG] Failed to read error response:', err)
                          }
                        }
                      })
                      .catch(err => {
                        console.error('❌ [AVATAR DEBUG] Re-check fetch exception:', {
                          error: err,
                          message: err.message,
                          stack: err.stack
                        })
                      })
                  } else {
                    console.warn('⚠️ [AVATAR DEBUG] No avatarUrl to re-check')
                  }
                }}
                onLoad={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  if (user?.avatar) {
                    console.log('✅ [AVATAR DEBUG] Avatar image loaded successfully in <img> tag!', {
                      avatar: user.avatar,
                      url: avatarUrl,
                      key: avatarKey,
                      naturalWidth: target.naturalWidth,
                      naturalHeight: target.naturalHeight,
                      src: target.src,
                      currentSrc: target.currentSrc,
                      isBlob: avatarUrl?.startsWith('blob:'),
                      dimensions: `${target.naturalWidth}x${target.naturalHeight}`
                    })
                  }
                }}
                onLoadStart={() => {
                  console.log('🔄 [AVATAR DEBUG] Avatar image load started in <img> tag:', {
                    url: avatarUrl,
                    isBlob: avatarUrl?.startsWith('blob:'),
                    avatar: user?.avatar
                  })
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
                console.log('Button clicked')
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
                console.log('Input onChange triggered', { 
                  hasFiles: !!e.target.files,
                  fileCount: e.target.files?.length 
                })
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
