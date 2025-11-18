import React from 'react'
import { useManagementData } from '@/hooks/use-management-data'
import { useManagementStore } from '@/stores/management-store'
import { ManagementAccessDenied } from './management-access-denied'
import { ManagementPageHeader } from './management-page-header'
import { ManagementPageContent } from './management-page-content'
import { ManagementDialogs } from './management-dialogs'
import type { Game } from '@/entities/game'

export default function ManagementPage() {

  const {
    isAuthenticated,
    user,
    hasAccess,
  } = useManagementData()

  const {
    openViewGameDialog,
    closeViewGameDialog,
  } = useManagementStore()

  const handleViewGame = (game: Game) => {
    openViewGameDialog(game)
  }

  const handleEditGame = (game: Game) => {

    closeViewGameDialog()
  }

  const handleUploadGame = (game: Game) => {

    closeViewGameDialog()
  }

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