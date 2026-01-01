"use client"

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
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && isEditing && !isLoading) {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    }
  }

  return (
    <Card className="border rounded-lg bg-background shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-semibold">General Information</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Manage your personal and contact information</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {isEditing ? (
              <>
                <Button 
                  type="button" 
                  onClick={handleSaveClick} 
                  size="sm" 
                  disabled={isLoading} 
                  className="h-8 text-xs w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  onClick={onCancel} 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs w-full sm:w-auto"
                >
                  <X className="h-3 w-3 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                type="button" 
                onClick={onEdit} 
                size="sm" 
                className="h-8 text-xs w-full sm:w-auto"
              >
                <Edit className="h-3 w-3 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-xs">First Name</Label>
            <Input
              id="firstName"
              value={profileData.firstName}
              onChange={(e) => onInputChange('firstName', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              placeholder="Enter your first name"
              className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-xs">Last Name</Label>
            <Input
              id="lastName"
              value={profileData.lastName}
              onChange={(e) => onInputChange('lastName', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              placeholder="Enter your last name"
              className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-xs">Username</Label>
          <Input
            id="username"
            value={profileData.username}
            onChange={(e) => onInputChange('username', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            placeholder="Enter your username"
            className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
          />
          <p className="text-[10px] text-muted-foreground">
            {isEditing
              ? 'Username will be updated after saving'
              : 'Username can be changed in edit mode'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs">Email</Label>
          <Input
            id="email"
            type="email"
            value={profileData.email}
            onChange={(e) => onInputChange('email', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            placeholder="Enter your email"
            className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
          />
          <p className="text-[10px] text-muted-foreground">
            {isEditing
              ? 'Email will be updated after saving'
              : 'Email can be changed in edit mode'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio" className="text-xs">About</Label>
          <textarea
            id="bio"
            value={profileData.bio}
            onChange={(e) => onInputChange('bio', e.target.value)}
            disabled={!isEditing}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none focus-visible:bg-background border-muted-foreground/20"
            rows={4}
            placeholder="Tell us a little about yourself..."
            maxLength={500}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Maximum 500 characters</span>
            <span>{profileData.bio.length}/500</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


