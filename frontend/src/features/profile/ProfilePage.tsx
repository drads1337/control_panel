"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { User, Shield, Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfileData } from './hooks/use-profile-data'
import { ProfileCard } from './components/ProfileCard'
import { ProfileGeneralTab } from './components/ProfileGeneralTab'
import { ProfileSecurityTab } from './components/ProfileSecurityTab'
import { ProfileActivityTab } from './components/ProfileActivityTab'
import { AvatarCropDialog } from './components/AvatarCropDialog'

export default function ProfilePage() {
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
      },
      {
        value: 'activity',
        label: 'Activity',
        icon: Activity
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2">
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

                    <TabsContent value="general" className="space-y-0 mt-0">
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

                    <TabsContent value="security" className="space-y-0 mt-0">
                      <ProfileSecurityTab
                        passwordData={passwordData}
                        isPasswordChanging={isPasswordChanging}
                        onPasswordChange={handlePasswordDataChange}
                        onChangePassword={handlePasswordChange}
                      />
                    </TabsContent>

                    <TabsContent value="activity" className="space-y-0 mt-0">
                      <ProfileActivityTab />
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

