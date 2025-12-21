import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/shared/hooks/use-auth'
import { updateProfile, changePassword, uploadAvatar } from '@/entities/user/api/profile'
import { toast } from 'sonner'
import type { ProfileData, ChangePasswordData } from '@/entities/user'

export function useProfileData() {
  const { user, updateUser } = useAuth()

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Password changing state
  const [isPasswordChanging, setIsPasswordChanging] = useState(false)
  
  // Avatar upload state
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  // Profile data state - initialized from user
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    bio: user?.bio || '',
  })

  // Password data state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        bio: user.bio || '',
      })
    }
  }, [user])

  // Handle input change for profile data
  const handleInputChange = useCallback((field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  // Handle password data change
  const handlePasswordDataChange = useCallback((field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  // Handle save profile
  const handleSave = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const profileUpdateData: ProfileData = {
        username: profileData.username,
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        email: profileData.email,
        bio: profileData.bio,
      }

      const response = await updateProfile(profileUpdateData)
      
      if (response.user) {
        // Update user in auth context
        updateUser({
          username: response.user.username,
          first_name: response.user.first_name,
          last_name: response.user.last_name,
          email: response.user.email,
          bio: response.user.bio,
        })
        
        toast.success('Profile updated successfully')
        setIsEditing(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }, [user, profileData, updateUser])

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        bio: user.bio || '',
      })
    }
    setIsEditing(false)
  }, [user])

  // Handle password change
  const handlePasswordChange = useCallback(async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    setIsPasswordChanging(true)
    try {
      const passwordChangeData: ChangePasswordData = {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      }

      await changePassword(passwordChangeData)
      
      toast.success('Password changed successfully')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsPasswordChanging(false)
    }
  }, [passwordData])

  // Handle avatar upload (file selection)
  const handleAvatarUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setSelectedImageFile(file)
    setCropDialogOpen(true)
    
    // Reset input
    event.target.value = ''
  }, [])

  // Handle crop complete
  const handleCropComplete = useCallback(async (
    file: File,
    cropData: { x: number; y: number; width: number; height: number }
  ) => {
    setIsAvatarUploading(true)
    setCropDialogOpen(false)

    try {
      const response = await uploadAvatar(file, cropData)
      
      if (response.avatar) {
        // Update user in auth context
        updateUser({ avatar: response.avatar })
        toast.success('Avatar updated successfully')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setIsAvatarUploading(false)
      setSelectedImageFile(null)
    }
  }, [updateUser])

  return {
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
  }
}

