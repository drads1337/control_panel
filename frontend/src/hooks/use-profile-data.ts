import { useState } from 'react'
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
    const file = event.target.files?.[0]
    if (!file || !token) return

    const validation = validateAvatarFile(file)
    if (!validation.success) {
      toast.error(validation.error)
      return
    }

    setIsAvatarUploading(true)
    try {
      const response = await uploadAvatar(validation.file)

      updateUser({
        ...user,
        avatar: response.avatar,
      })

      toast.success('Avatar updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error uploading avatar')
    } finally {
      setIsAvatarUploading(false)

      if (event.target) {
        event.target.value = ''
      }
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
  }
}
