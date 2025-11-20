import { useState, useEffect } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { updateProfile, changePassword, uploadAvatar } from '@/entities/user'
import { toast } from 'sonner'
import {
  validateProfile,
  validatePasswordChange,
  validateAvatarFile,
  getFirstValidationError,
} from '@/lib/validations'

export function useProfileData() {
  const { user, token, updateUser } = useAuthContext()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordChanging, setIsPasswordChanging] = useState(false)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    bio: '',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Sync profileData with user when user changes and not editing
  useEffect(() => {
    if (!isEditing && user) {
      setProfileData((prev) => ({
        username: user.username || '',
        email: user.email || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        bio: prev.bio, // Keep existing bio value since it's not on User type
      }))
    }
  }, [user, isEditing])

  const handleSave = async () => {
    if (!token) return

    const validation = validateProfile({
      username: profileData.username.trim(),
      email: profileData.email.trim(),
      first_name: profileData.firstName.trim(),
      last_name: profileData.lastName.trim(),
      bio: profileData.bio.trim(),
    })

    if (!validation.success) {
      const errorMessage = getFirstValidationError(validation.errors)
      toast.error(errorMessage)
      return
    }

    setIsLoading(true)
    try {
      const response = await updateProfile(validation.data)

      updateUser({
        ...user,
        username: response.user.username,
        first_name: response.user.first_name,
        last_name: response.user.last_name,
        bio: response.user.bio,
        email: response.user.email,
      })

      toast.success('Profile updated successfully')
      setIsEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setProfileData({
      username: user?.username || '',
      email: user?.email || '',
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      bio: '',
    })
    setIsEditing(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePasswordChange = async () => {
    if (!token) return

    const validation = validatePasswordChange({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmPassword: passwordData.confirmPassword,
    })

    if (!validation.success) {
      const errorMessage = getFirstValidationError(validation.errors)
      toast.error(errorMessage)
      return
    }

    setIsPasswordChanging(true)
    try {
      await changePassword({
        current_password: validation.data.currentPassword,
        new_password: validation.data.newPassword,
      })

      toast.success('Password changed successfully')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error changing password')
    } finally {
      setIsPasswordChanging(false)
    }
  }

  const handlePasswordDataChange = (field: string, value: string) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleAvatarUpload called', { 
      hasFiles: !!event.target.files, 
      fileCount: event.target.files?.length
    })
    
    const file = event.target.files?.[0]
    console.log('Selected file:', file ? { name: file.name, size: file.size, type: file.type } : 'no file')
    
    if (!file) {
      console.warn('No file selected')
      return
    }

    console.log('Validating file...')
    const validation = validateAvatarFile(file)
    console.log('Validation result:', validation)
    if (!validation.success) {
      toast.error(validation.error)
      return
    }

    // Open crop dialog instead of direct upload
    setSelectedImageFile(validation.file)
    setCropDialogOpen(true)

    // Clear input
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleCropComplete = async (file: File, cropData: { x: number; y: number; width: number; height: number }) => {
    setIsAvatarUploading(true)
    setCropDialogOpen(false)
    
    try {
      const response = await uploadAvatar(file, cropData)
      
      console.log('Avatar upload response:', response)

      if (user && response.avatar) {
        const updatedUser = {
          ...user,
          avatar: response.avatar,
        }
        console.log('Updating user with avatar:', updatedUser.avatar)
        updateUser(updatedUser)
        
        // Small delay to ensure component update
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log('User updated, avatar should now be visible')
      } else {
        console.warn('User is null or response.avatar is missing', { user, response })
      }

      toast.success('Avatar updated successfully')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error(error instanceof Error ? error.message : 'Error uploading avatar')
    } finally {
      setIsAvatarUploading(false)
      setSelectedImageFile(null)
    }
  }

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