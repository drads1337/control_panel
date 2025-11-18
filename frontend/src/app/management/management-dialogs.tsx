import React, { Suspense } from 'react'
import { useManagementStore } from '@/stores/management-store'
import type { Game } from '@/entities/game'

const ViewGameDialog = React.lazy(() =>
  import('./games').then((module) => ({ default: module.ViewGameDialog }))
)

interface ManagementDialogsProps {
  onEditGame: (game: Game) => void
  onUploadGame: (game: Game) => void
}

export function ManagementDialogs({ onEditGame, onUploadGame }: ManagementDialogsProps) {
  const {
    dialogs,
    setViewGameDialogOpen,
  } = useManagementStore()

  const { viewGameDialogOpen, selectedGame } = dialogs

  return (
    <Suspense fallback={null}>
      <ViewGameDialog
        open={viewGameDialogOpen}
        onOpenChange={setViewGameDialogOpen}
        game={selectedGame}
        onEdit={onEditGame}
        onUpload={onUploadGame}
      />
    </Suspense>
  )
}
