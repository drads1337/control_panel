import React, { useState, useMemo, useCallback } from 'react'
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { User, Shield, Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserActivityList } from '../users/user-activity-list'
import { ProfileCard } from './profile-card'
import { ProfileGeneralTab } from './profile-general-tab'
import { ProfileSecurityTab } from './profile-security-tab'
import { useProfileData } from '@/hooks/use-profile-data'
import { AvatarCropDialog } from './avatar-crop-dialog'

const ProfileMain: React.FC = () => {
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
      // Simple refresh - reload the page to get fresh data
      window.location.reload()
    } catch (error) {
      // Error refreshing
    } finally {
      setRefreshing(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      {}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-2">
              Manage your personal information and account settings
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div className="lg:col-span-1">
          <ProfileCard
            user={user}
            profileData={profileData}
            isAvatarUploading={isAvatarUploading}
            onAvatarUpload={handleAvatarUpload}
          />
        </div>

        {}
        <div className="lg:col-span-2">
          {availableTabs.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="relative mb-4">
                <TabsList 
                  className={`grid w-full h-14 bg-muted border border-border rounded-lg p-1`} 
                  style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}
                >
                  {availableTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="flex items-center justify-center gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              <TabsContents>
                <TabsContent value="general" className="space-y-6">
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

                <TabsContent value="security" className="space-y-6">
                  <ProfileSecurityTab
                    passwordData={passwordData}
                    isPasswordChanging={isPasswordChanging}
                    onPasswordChange={handlePasswordDataChange}
                    onChangePassword={handlePasswordChange}
                  />
                </TabsContent>

                <TabsContent value="activity" className="space-y-6">
                  <UserActivityList />
                </TabsContent>
              </TabsContents>
            </Tabs>
          )}
        </div>
      </div>

      {/* Диалог обрезки аватара */}
      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageFile={selectedImageFile}
        onCropComplete={handleCropComplete}
      />
    </div>
  )
}

export default ProfileMain