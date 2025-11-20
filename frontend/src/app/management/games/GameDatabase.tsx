import React from 'react';
import { AlertTriangle, CheckCircle, Plus, RefreshCw, Search, Check, X, Package } from 'lucide-react';
import { useGameManagement } from '@/hooks/use-game-management';
import { useGamePermissions } from '@/hooks/use-game-permissions';
import { useGameFilters } from '@/hooks/use-game-filters';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { BulkActionsPanel } from './BulkActionsPanel';
import { GamesTable } from './GamesTable';
import { GameDatabaseEmptyState } from './GameDatabaseEmptyState';
import { GameDatabaseErrorState } from './GameDatabaseErrorState';
import { GameDatabaseAccessDenied } from './GameDatabaseAccessDenied';
import { GameDatabaseDialogs } from './GameDatabaseDialogs';
import type { Game, Product } from '@/entities/game';  // Game is alias for Product

interface ProductDatabaseProps {
  onViewProduct?: (product: Product) => void;  // Universal name
  onCreateProduct?: () => void;  // Universal name
  onCreateProductRequested?: boolean;  // Universal name
  onCreateProductRequestHandled?: () => void;  // Universal name
  // Backward compatibility aliases
  onViewGame?: (game: Product) => void;
  onCreateGame?: () => void;
  onCreateGameRequested?: boolean;
  onCreateGameRequestHandled?: () => void;
}

// Backward compatibility alias
interface GameDatabaseProps extends ProductDatabaseProps {}

const ProductDatabase: React.FC<ProductDatabaseProps> = ({ 
  onViewProduct,
  onCreateProduct,
  onCreateProductRequested,
  onCreateProductRequestHandled,
  // Backward compatibility - destructure games props
  onViewGame,
  onCreateGame,
  onCreateGameRequested,
  onCreateGameRequestHandled,
}) => {
  // Use universal names with fallback to backward compatibility
  const onView = onViewProduct || onViewGame;
  const onCreate = onCreateProduct || onCreateGame;
  const onCreateRequested = onCreateProductRequested || onCreateGameRequested;
  const onCreateHandled = onCreateProductRequestHandled || onCreateGameRequestHandled;

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
  } = useGameManagement(onView, onCreate);

  React.useEffect(() => {
    if (onCreateRequested) {
      setShowCreateDialog(true);
      onCreateHandled?.();
    }
  }, [onCreateRequested, onCreateHandled, setShowCreateDialog]);

  const { filters, filteredGames, updateFilters, resetFilters } = useGameFilters(games);
  
  const allSelected = selectedGames.length === filteredGames.length && filteredGames.length > 0;
  
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedGames([]);
    } else {
      setSelectedGames(filteredGames.map((g) => g.id));
    }
  };
  
  const clearSelection = () => {
    setSelectedGames([]);
  };

  if (!canViewGames) {
    return <GameDatabaseAccessDenied />;
  }

  if (error) {
    return <GameDatabaseErrorState error={error} onRetry={fetchGames} />;
  }

  return (
    <div className="space-y-4">
      {}
      {!loading && filteredGames.length === 0 && games.length === 0 ? (
        <GameDatabaseEmptyState 
          onCreateGame={() => setShowCreateDialog(true)}
          canCreateGames={canCreateGames}
        />
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Applications</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {filteredGames.length} {filteredGames.length === 1 ? 'application' : 'applications'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={fetchGames}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ConditionalRender permission="games.create" fallback={null}>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </ConditionalRender>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                  className="pl-8"
                />
              </div>
              <Select 
                value={filters.status} 
                onValueChange={(value: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing') =>
                  updateFilters({ status: value })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedGames.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Selected: {selectedGames.length} {selectedGames.length === 1 ? 'application' : 'applications'}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <ConditionalRender 
                    permissions={['games.status', 'games.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <ConditionalRender permission="games.status" fallback={null}>
                          <SelectItem value="active">Activate</SelectItem>
                          <SelectItem value="inactive">Deactivate</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                        </ConditionalRender>
                        <ConditionalRender permission="games.delete" fallback={null}>
                          <SelectItem value="delete">Delete</SelectItem>
                        </ConditionalRender>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkAction} 
                      disabled={!bulkAction || (!canManageStatus && !canDeleteGames)} 
                      size="sm"
                    >
                      Apply
                    </Button>
                  </ConditionalRender>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 -mt-3">
            {loading ? (
              <Spinner message="Loading applications..." />
            ) : filteredGames.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <div className="text-sm text-muted-foreground">No applications found</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredGames.length === 0}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                </div>
                <GamesTable
                  products={filteredGames}
                  selectedProducts={selectedGames}
                  onToggleProductSelection={toggleGameSelection}
                  onSelectAll={handleSelectAll}
                  onViewProduct={handleViewGame}
                  onEditProduct={handleEditGame}
                  onUploadProduct={handleUploadGame}
                  onNotificationsProduct={handleNotificationsGame}
                  onPricesProduct={handlePricesGame}
                  onChangelogProduct={handleChangelogGame}
                  onStatusChange={handleStatusChange}
                  onDeleteProduct={handleDeleteGame}
                  // Backward compatibility aliases
                  games={filteredGames}
                  selectedGames={selectedGames}
                  onToggleGameSelection={toggleGameSelection}
                  onViewGame={handleViewGame}
                  onEditGame={handleEditGame}
                  onUploadGame={handleUploadGame}
                  onNotificationsGame={handleNotificationsGame}
                  onPricesGame={handlePricesGame}
                  onChangelogGame={handleChangelogGame}
                  onDeleteGame={handleDeleteGame}
                  canEditGames={canEditGames}
                  canDeleteGames={canDeleteGames}
                  canUploadFiles={canUploadFiles}
                  canManageNotifications={canManageNotifications}
                  canManagePrices={canManagePrices}
                  canManageChangelog={canManageChangelog}
                  canManageStatus={canManageStatus}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {}
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

      {}
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

export default ProductDatabase;

// Backward compatibility alias
const GameDatabase = ProductDatabase;
export { GameDatabase };