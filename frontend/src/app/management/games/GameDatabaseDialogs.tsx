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
  // Dialog states
  showCreateDialog: boolean
  showEditDialog: boolean
  showUploadDialog: boolean
  showPricesDialog: boolean
  showNotificationsDialog: boolean
  showChangelogDialog: boolean
  
  // Selected game
  selectedGame: Game | null
  
  // Permissions
  canEditGames: boolean
  canCreateGames: boolean
  canUploadFiles: boolean
  canManagePrices: boolean
  canManageNotifications: boolean
  canManageChangelog: boolean
  
  // Handlers
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
      {/* Prices Dialog */}
      {canManagePrices && showPricesDialog && selectedGame && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={closeAllDialogs}>
            <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Manage Prices: {selectedGame.name}</h3>
                <Button variant="outline" onClick={closeAllDialogs}>
                  Close
                </Button>
              </div>
              <PriceManager 
                open={showPricesDialog} 
                onOpenChange={setShowPricesDialog}
                gameId={selectedGame.id} 
              />
            </div>
          </div>
        )}

      {/* Notifications Dialog */}
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

      {/* Upload Dialog */}
      {canUploadFiles && (
        <GameFileUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          game={selectedGame}
          onUploadComplete={onUploadComplete}
        />
      )}

      {/* Edit Game Dialog */}
      {canEditGames && (
        <EditGameDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          game={selectedGame}
          onSuccess={onSuccess}
        />
      )}

      {/* Create Game Dialog */}
      {canCreateGames && (
        <CreateGameDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onSuccess}
        />
      )}

      {/* Changelog Management Dialog */}
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

