import React from 'react'
import { useManagementData } from '@/hooks/use-management-data'
import { useManagementStore } from '@/stores/management-store'
import { ManagementAccessDenied } from './management-access-denied'
import { ManagementPageHeader } from './management-page-header'
import { ManagementPageContent } from './management-page-content'
import { ManagementDialogs } from './management-dialogs'
import type { Game } from '@/entities/game'

export default function ManagementPage() {
  // Use custom hook for management data and permissions
  const {
    isAuthenticated,
    user,
    hasAccess,
  } = useManagementData()

  // Use Zustand store for UI state only (dialogs)
  const {
    openViewGameDialog,
    closeViewGameDialog,
  } = useManagementStore()

  // Game dialog handlers
  const handleViewGame = (game: Game) => {
    openViewGameDialog(game)
  }

  const handleEditGame = (game: Game) => {
    // Handle edit game logic
    closeViewGameDialog()
  }

  const handleUploadGame = (game: Game) => {
    // Handle upload game logic
    closeViewGameDialog()
  }

  // Show access denied if user doesn't have management access
  if (!isAuthenticated || !hasAccess) {
    return (
      <ManagementAccessDenied
        isAuthenticated={isAuthenticated}
        hasAccess={hasAccess}
        user={user}
      />
    )
  }

  return (
    <div className="space-y-6">
      <ManagementPageHeader />
      <ManagementPageContent />
      <ManagementDialogs onEditGame={handleEditGame} onUploadGame={handleUploadGame} />
    </div>
  )
}