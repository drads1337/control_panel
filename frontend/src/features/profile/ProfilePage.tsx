import React from 'react'
import { useProfileData } from '@/features/profile/hooks/use-profile-data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Separator } from '@/shared/ui/components/separator'
import { Input } from '@/shared/ui/components/input'
import { Textarea } from '@/shared/ui/components/textarea'
import { Button } from '@/shared/ui/components/button'
import { Label } from '@/shared/ui/components/label'

const ProfilePage: React.FC = () => {
  const {
    user,
    profileData,
    isEditing,
    isLoading,
    handleInputChange,
    handleSave,
    handleCancel,
    setIsEditing,
  } = useProfileData()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark text-text-primary-dark">
        <p className="text-text-secondary-dark">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
        <Card className="bg-surface-dark border-border-dark rounded p-5 relative shadow-sm">
          <CardHeader className="mb-5 pb-3 flex flex-col gap-3 p-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  PROFILE
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary-dark mt-1">Manage your account settings and preferences.</CardDescription>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-primary text-background-dark text-xs font-bold uppercase tracking-widest rounded hover:bg-primary-hover transition-all shadow-glow"
                >
                  Edit
                </Button>
              )}
            </div>
            <Separator className="border-border-dark" />
          </CardHeader>
          <CardContent className="space-y-6 p-0">
            <div className="space-y-2">
              <Label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest">
                Username
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="block w-full px-3 py-2.5 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              ) : (
                <p className="text-text-primary-dark">{user.username || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest">
                First Name
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="block w-full px-3 py-2.5 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              ) : (
                <p className="text-text-primary-dark">{user.first_name || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest">
                Last Name
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="block w-full px-3 py-2.5 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              ) : (
                <p className="text-text-primary-dark">{user.last_name || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest">
                Email
              </Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="block w-full px-3 py-2.5 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              ) : (
                <p className="text-text-primary-dark">{user.email || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest">
                Bio
              </Label>
              {isEditing ? (
                <Textarea
                  value={profileData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="block w-full px-3 py-2.5 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  rows={4}
                />
              ) : (
                <p className="text-text-primary-dark">{user.bio || 'N/A'}</p>
              )}
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary text-background-dark text-xs font-bold uppercase tracking-widest rounded hover:bg-[#CBD5E1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={isLoading}
                  variant="outline"
                  className="px-4 py-2 bg-background-dark border border-border-dark text-text-primary-dark text-xs font-bold uppercase tracking-widest rounded hover:bg-surface-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}

export default ProfilePage

