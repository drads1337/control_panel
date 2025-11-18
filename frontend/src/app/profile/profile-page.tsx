import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Shield, Activity } from 'lucide-react'
import { UserActivityList } from '../users/user-activity-list'
import { ProfileHeader } from './profile-header'
import { ProfileCard } from './profile-card'
import { ProfileGeneralTab } from './profile-general-tab'
import { ProfileSecurityTab } from './profile-security-tab'
import { useProfileData } from '@/hooks/use-profile-data'

export default function Profile() {
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
  } = useProfileData()

  return (
    <div>
      <ProfileHeader />

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
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-14 bg-muted border border-border rounded-lg">
              <TabsTrigger
                value="general"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <User className="h-4 w-4" />
                <span>General</span>
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Shield className="h-4 w-4" />
                <span>Security</span>
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Activity className="h-4 w-4" />
                <span>Activity</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
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

            <TabsContent value="security">
              <ProfileSecurityTab
                passwordData={passwordData}
                isPasswordChanging={isPasswordChanging}
                onPasswordChange={handlePasswordDataChange}
                onChangePassword={handlePasswordChange}
              />
            </TabsContent>

            <TabsContent value="activity">
              <UserActivityList />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}