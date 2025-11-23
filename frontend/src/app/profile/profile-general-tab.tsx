import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit, Save, X, Loader2 } from 'lucide-react'

interface ProfileGeneralTabProps {
  profileData: {
    username: string
    email: string
    firstName: string
    lastName: string
    bio: string
  }
  isEditing: boolean
  isLoading: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onInputChange: (field: string, value: string) => void
}

export function ProfileGeneralTab({
  profileData,
  isEditing,
  isLoading,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
}: ProfileGeneralTabProps) {
  const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (isEditing && !isLoading && onSave) {
      onSave()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Saving on Enter won't work for textarea
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && isEditing && !isLoading) {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>General Information</CardTitle>
            <CardDescription>Manage your personal and contact information</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {isEditing ? (
              <>
                <Button type="button" onClick={handleSaveClick} size="sm" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button type="button" onClick={onCancel} variant="outline" size="sm" className="w-full sm:w-auto">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" onClick={onEdit} size="sm" className="w-full sm:w-auto">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={profileData.firstName}
              onChange={(e) => onInputChange('firstName', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              placeholder="Enter your first name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={profileData.lastName}
              onChange={(e) => onInputChange('lastName', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              placeholder="Enter your last name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profileData.username}
            onChange={(e) => onInputChange('username', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            placeholder="Enter your username"
          />
          <p className="text-xs text-muted-foreground">
            {isEditing
              ? 'Username will be updated after saving'
              : 'Username can be changed in edit mode'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profileData.email}
            onChange={(e) => onInputChange('email', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            placeholder="Enter your email"
          />
          <p className="text-xs text-muted-foreground">
            {isEditing
              ? 'Email will be updated after saving'
              : 'Email can be changed in edit mode'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">About</Label>
          <textarea
            id="bio"
            value={profileData.bio}
            onChange={(e) => onInputChange('bio', e.target.value)}
            disabled={!isEditing}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            rows={4}
            placeholder="Tell us a little about yourself..."
            maxLength={500}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Maximum 500 characters</span>
            <span>{profileData.bio.length}/500</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}