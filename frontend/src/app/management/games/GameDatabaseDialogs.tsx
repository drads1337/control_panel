import React from 'react'
import { Button } from '@/components/ui/button'
import EditGameDialog from './EditGameDialog'
import CreateGameDialog from './CreateGameDialog'
import GameFileUploadDialog from './GameFileUploadDialog'
import NotificationsDialog from '../notifications/NotificationsDialog'
import ChangelogManagementDialog from '../changelog/ChangelogManagementDialog'
import PriceManager from '../PriceManager'
import type { Game } from '@/entities/game'

interface GameDatabaseDialogsProps {

  showCreateDialog: boolean
  showEditDialog: boolean
  showUploadDialog: boolean
  showPricesDialog: boolean
  showNotificationsDialog: boolean
  showChangelogDialog: boolean

  selectedGame: Game | null

  canEditGames: boolean
  canCreateGames: boolean
  canUploadFiles: boolean
  canManagePrices: boolean
  canManageNotifications: boolean
  canManageChangelog: boolean

  setShowCreateDialog: (open: boolean) => void
  setShowEditDialog: (open: boolean) => void
  setShowUploadDialog: (open: boolean) => void
  setShowPricesDialog: (open: boolean) => void
  setShowNotificationsDialog: (open: boolean) => void
  setShowChangelogDialog: (open: boolean) => void
  closeAllDialogs: () => void
  onSuccess: () => void
  onUploadComplete: () => void
}

export function GameDatabaseDialogs({
  showCreateDialog,
  showEditDialog,
  showUploadDialog,
  showPricesDialog,
  showNotificationsDialog,
  showChangelogDialog,
  selectedGame,
  canEditGames,
  canCreateGames,
  canUploadFiles,
  canManagePrices,
  canManageNotifications,
  canManageChangelog,
  setShowCreateDialog,
  setShowEditDialog,
  setShowUploadDialog,
  setShowPricesDialog,
  setShowNotificationsDialog,
  setShowChangelogDialog,
  closeAllDialogs,
  onSuccess,
  onUploadComplete,
}: GameDatabaseDialogsProps) {
  return (
    <>
      {}
      {canManagePrices && (
        <PriceManager 
          open={showPricesDialog && !!selectedGame} 
          onOpenChange={setShowPricesDialog}
          gameId={selectedGame?.id} 
        />
      )}

      {}
      <NotificationsDialog
        key="notifications-dialog"
        open={showNotificationsDialog && canManageNotifications}
        onOpenChange={(open) => {
          if (canManageNotifications) {
            setShowNotificationsDialog(open)
          }
        }}
        game={canManageNotifications ? selectedGame : null}
      />

      {}
      {canUploadFiles && (
        <GameFileUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          game={selectedGame}
          onUploadComplete={onUploadComplete}
        />
      )}

      {}
      {canEditGames && (
        <EditGameDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          game={selectedGame}
          onSuccess={onSuccess}
        />
      )}

      {}
      {canCreateGames && (
        <CreateGameDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onSuccess}
        />
      )}

      {}
      <ChangelogManagementDialog
        key="changelog-dialog"
        open={showChangelogDialog && canManageChangelog}
        onOpenChange={(open) => {
          if (canManageChangelog) {
            setShowChangelogDialog(open)
          }
        }}
        game={canManageChangelog ? selectedGame : null}
      />
    </>
  )
}
