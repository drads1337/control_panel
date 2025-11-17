import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useGameManagement } from '@/hooks/use-game-management';
import { useGamePermissions } from '@/hooks/use-game-permissions';
import { useGameFilters } from '@/hooks/use-game-filters';
import { Spinner } from '@/components/ui/spinner';
import { BulkActionsPanel } from './BulkActionsPanel';
import { GamesTable } from './GamesTable';
import { GameDatabaseEmptyState } from './GameDatabaseEmptyState';
import { GameDatabaseErrorState } from './GameDatabaseErrorState';
import { GameDatabaseAccessDenied } from './GameDatabaseAccessDenied';
import { GameDatabaseDialogs } from './GameDatabaseDialogs';
import type { Game } from '@/entities/game';

interface GameDatabaseProps {
  onViewGame?: (game: Game) => void;
  onCreateGame?: () => void;
  onCreateGameRequested?: boolean;
  onCreateGameRequestHandled?: () => void;
}

const GameDatabase: React.FC<GameDatabaseProps> = ({ onViewGame, onCreateGame, onCreateGameRequested, onCreateGameRequestHandled }) => {
  // Permissions logic - extracted to custom hook
  const {
    canViewGames,
    canCreateGames,
    canEditGames,
    canDeleteGames,
    canUploadFiles,
    canManagePrices,
    canManageChangelog,
    canManageNotifications,
    canManageStatus,
  } = useGamePermissions();

  // Game management logic - extracted to custom hook
  const {
    games,
    loading,
    error,
    selectedGames,
    bulkAction,
    showCreateDialog,
    showPricesDialog,
    showNotificationsDialog,
    showUploadDialog,
    showEditDialog,
    showChangelogDialog,
    selectedGame,
    notification,
    fetchGames,
    toggleGameSelection,
    handleBulkAction,
    handleStatusChange,
    handleDeleteGame,
    handleViewGame,
    handleEditGame,
    handleUploadGame,
    handleNotificationsGame,
    handlePricesGame,
    handleChangelogGame,
    closeAllDialogs,
    setBulkAction,
    setSelectedGames,
    setShowCreateDialog,
    setShowPricesDialog,
    setShowNotificationsDialog,
    setShowUploadDialog,
    setShowEditDialog,
    setShowChangelogDialog,
    setSelectedGame,
  } = useGameManagement(onViewGame, onCreateGame);

  // Handle external create game request from parent
  React.useEffect(() => {
    if (onCreateGameRequested) {
      setShowCreateDialog(true);
      onCreateGameRequestHandled?.();
    }
  }, [onCreateGameRequested, onCreateGameRequestHandled, setShowCreateDialog]);

  // Filtering logic - extracted to custom hook
  const { filteredGames } = useGameFilters(games);


  // Early returns for permission and error states
  if (!canViewGames) {
    return <GameDatabaseAccessDenied />;
  }

  if (error) {
    return <GameDatabaseErrorState error={error} onRetry={fetchGames} />;
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      {games.length > 0 && (
        <BulkActionsPanel
          selectedCount={selectedGames.length}
          bulkAction={bulkAction}
          onBulkActionChange={setBulkAction}
          onApply={handleBulkAction}
          onClear={() => setSelectedGames([])}
          canManageStatus={canManageStatus}
          canDeleteGames={canDeleteGames}
        />
      )}

      {/* Empty State */}
      {!loading && filteredGames.length === 0 ? (
        <GameDatabaseEmptyState 
          onCreateGame={() => setShowCreateDialog(true)}
          canCreateGames={canCreateGames}
        />
      ) : (
        /* Games Table */
        <>
          {loading ? (
            <div className="p-8">
              <Spinner message="Loading applications..." />
            </div>
          ) : (
            <GamesTable
              games={filteredGames}
              selectedGames={selectedGames}
              onToggleGameSelection={toggleGameSelection}
              onSelectAll={(selected) =>
                setSelectedGames(selected ? filteredGames.map((g) => g.id) : [])
              }
              onViewGame={handleViewGame}
              onEditGame={handleEditGame}
              onUploadGame={handleUploadGame}
              onNotificationsGame={handleNotificationsGame}
              onPricesGame={handlePricesGame}
              onChangelogGame={handleChangelogGame}
              onStatusChange={handleStatusChange}
              onDeleteGame={handleDeleteGame}
              canEditGames={canEditGames}
              canDeleteGames={canDeleteGames}
              canUploadFiles={canUploadFiles}
              canManageNotifications={canManageNotifications}
              canManagePrices={canManagePrices}
              canManageChangelog={canManageChangelog}
              canManageStatus={canManageStatus}
            />
          )}
        </>
      )}

      {/* Dialogs Container */}
      <GameDatabaseDialogs
        showCreateDialog={showCreateDialog}
        showEditDialog={showEditDialog}
        showUploadDialog={showUploadDialog}
        showPricesDialog={showPricesDialog}
        showNotificationsDialog={showNotificationsDialog}
        showChangelogDialog={showChangelogDialog}
        selectedGame={selectedGame}
        canEditGames={canEditGames}
        canCreateGames={canCreateGames}
        canUploadFiles={canUploadFiles}
        canManagePrices={canManagePrices}
        canManageNotifications={canManageNotifications}
        canManageChangelog={canManageChangelog}
        setShowCreateDialog={setShowCreateDialog}
        setShowEditDialog={setShowEditDialog}
        setShowUploadDialog={setShowUploadDialog}
        setShowPricesDialog={setShowPricesDialog}
        setShowNotificationsDialog={setShowNotificationsDialog}
        setShowChangelogDialog={setShowChangelogDialog}
        closeAllDialogs={closeAllDialogs}
        onSuccess={() => {
          fetchGames();
          setSelectedGame(null);
        }}
        onUploadComplete={() => {
          fetchGames();
          setSelectedGame(null);
        }}
      />

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
          notification.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameDatabase;