"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { User, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useProfileData } from './hooks/use-profile-data'
import { ProfileCard } from './components/ProfileCard'
import { ProfileGeneralTab } from './components/ProfileGeneralTab'
import { ProfileSecurityTab } from './components/ProfileSecurityTab'
import { AvatarCropDialog } from './components/AvatarCropDialog'
import { AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'

export default function ProfilePage() {
  const authContext = useAuthContext()
  const { user: authUser, isAuthenticated, isInitialized } = authContext
  
  const {
    user,
    profileData,
    passwordData,
    isEditing,
    isLoading,
    isPasswordChanging,
    isAvatarUploading,
    setIsEditing,
    handleSave,
    handleCancel,
    handleInputChange,
    handlePasswordChange,
    handlePasswordDataChange,
    handleAvatarUpload,
    cropDialogOpen,
    setCropDialogOpen,
    selectedImageFile,
    handleCropComplete,
  } = useProfileData()

  const [activeTab, setActiveTab] = useState('general')
  const [refreshing, setRefreshing] = useState(false)

  // All hooks must be called before any early returns
  const availableTabs = useMemo(() => {
    return [
      {
        value: 'general',
        label: 'General',
        icon: User
      },
      {
        value: 'security',
        label: 'Security',
        icon: Shield
      }
    ]
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      window.location.reload()
    } catch (error) {
      // Error refreshing
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Early returns after all hooks have been called
  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !authUser) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={authUser}
        message="You need to be logged in to view your profile."
        useCard={true}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  My Profile
                </h1>
                <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                  Manage your personal information and account settings
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRefresh} 
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-4 lg:px-6 flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Left Column: Profile Card */}
              <div className="lg:col-span-1">
                <ProfileCard
                  user={user}
                  profileData={profileData}
                  isAvatarUploading={isAvatarUploading}
                  onAvatarUpload={handleAvatarUpload}
                />
              </div>

              {/* Right Column: Tabs */}
              <div className="lg:col-span-2">
                {availableTabs.length > 0 && (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-col justify-start gap-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label htmlFor="profile-view-selector" className="sr-only">
                        View
                      </Label>
                      <Select value={activeTab} onValueChange={setActiveTab}>
                        <SelectTrigger
                          className="flex w-fit h-7 text-xs @4xl/main:hidden"
                          size="sm"
                          id="profile-view-selector"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          {availableTabs.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value} className="text-xs">
                              {tab.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
                        {availableTabs.map((tab) => {
                          const Icon = tab.icon
                          return (
                            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{tab.label}</span>
                            </TabsTrigger>
                          )
                        })}
                      </TabsList>
                    </div>
                    <TabsContent value="general" className="relative flex flex-col gap-3 overflow-auto space-y-0 mt-0">
                      <ProfileGeneralTab
                        profileData={profileData}
                        isEditing={isEditing}
                        isLoading={isLoading}
                        onEdit={() => setIsEditing(true)}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onInputChange={handleInputChange}
                      />
                    </TabsContent>

                    <TabsContent value="security" className="relative flex flex-col gap-3 overflow-auto space-y-0 mt-0">
                      <ProfileSecurityTab
                        passwordData={passwordData}
                        isPasswordChanging={isPasswordChanging}
                        onPasswordChange={handlePasswordDataChange}
                        onChangePassword={handlePasswordChange}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageFile={selectedImageFile}
        onCropComplete={handleCropComplete}
      />
    </div>
  )
}

