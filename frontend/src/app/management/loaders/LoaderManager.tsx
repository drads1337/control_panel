import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, Plus, Edit, Trash2, AlertTriangle, Upload, Bell, Eye, 
  Settings, Gamepad2, GitCommit, Search, RefreshCw, Check, X, Container
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { recordLoaderDownload } from '@/entities/loader';
import { useLoadersQuery } from '@/hooks/use-loaders-query';
import CreateLoaderDialog from './CreateLoaderDialog';
import EditLoaderDialog from './EditLoaderDialog';
import UploadLoaderFilesDialog from './UploadLoaderFilesDialog';
import LoaderDetailsDialog from './LoaderDetailsDialog';
import LoaderConfigDialog from './LoaderConfigDialog';
import AssignGamesDialog from './AssignGamesDialog';
import CreateGameDialog from '../games/CreateGameDialog';
import { toast } from 'sonner';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { Spinner } from '@/components/ui/spinner';
import type { Loader } from '@/entities/loader';
import type { Game } from '@/entities/game';

interface LoaderItemProps {
  loader: Loader;
  games: Game[];
  isSelected: boolean;
  onToggleSelection: (loaderId: number) => void;
  onViewDetails: (loader: Loader) => void;
  onEditLoader: (loader: Loader) => void;
  onConfigLoader: (loader: Loader) => void;
  onAssignGames: (loader: Loader) => void;
  onUploadFiles: (loader: Loader) => void;
  onNotificationsGame: (loader: Loader) => void;
  onChangelogGame: (loader: Loader) => void;
  onStatusChange: (loaderId: number, newStatus: Loader['status']) => void;
  onDeleteLoader: (loaderId: number) => void;
  canEditLoaders: boolean;
  canDeleteLoaders: boolean;
  canUploadFiles: boolean;
  canViewNotifications: boolean;
  canCreateNotifications: boolean;
  canEditNotifications: boolean;
  canViewChangelog: boolean;
  canCreateChangelog: boolean;
  canEditChangelog: boolean;
  canManageStatus: boolean;
  canAssignGames: boolean;
  canConfigurationSettings: boolean;
}

const LoaderItem = React.memo(({
  loader,
  games,
  isSelected,
  onToggleSelection,
  onViewDetails,
  onEditLoader,
  onConfigLoader,
  onAssignGames,
  onUploadFiles,
  onNotificationsGame,
  onChangelogGame,
  onStatusChange,
  onDeleteLoader,
  canEditLoaders,
  canDeleteLoaders,
  canUploadFiles,
  canViewNotifications,
  canCreateNotifications,
  canEditNotifications,
  canViewChangelog,
  canCreateChangelog,
  canEditChangelog,
  canManageStatus,
  canAssignGames,
  canConfigurationSettings,
}: LoaderItemProps) => {
  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>
        {getStatusText(statusType)}
      </span>
    );
  };

  const assignedGamesNames = useMemo(() => {
    return loader.assigned_games
      .map(gameId => games.find(g => g.id === gameId)?.name)
      .filter(Boolean)
      .join(', ');
  }, [loader.assigned_games, games]);

  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={isSelected}
          onChange={() => onToggleSelection(loader.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {loader.logo ? (
            <img src={loader.logo} alt={loader.name} className="w-7 h-7 rounded" />
          ) : (
            <Container className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate">{loader.name}</h4>
            {isSelected && (
              <Check className="h-3 w-3 text-primary" />
            )}
            {getStatusBadge(loader.status)}
          </div>
          {loader.description && (
            <p className="text-xs text-muted-foreground truncate mb-1">
              {loader.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="font-mono">ID: {loader.id}</span>
            <span>•</span>
            <span>v{loader.version}</span>
            <span>•</span>
            <span>{loader.downloads.toLocaleString()} downloads</span>
            <span>•</span>
            <span>{loader.active_users.toLocaleString()} users</span>
            {loader.assigned_games.length > 0 && (
              <>
                <span>•</span>
                <span>{loader.assigned_games.length} games</span>
              </>
            )}
            {assignedGamesNames && (
              <>
                <span>•</span>
                <span className="truncate max-w-xs" title={assignedGamesNames}>
                  {assignedGamesNames}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewDetails(loader)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        {canEditLoaders && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditLoader(loader)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {canConfigurationSettings && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onConfigLoader(loader)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        {canAssignGames && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAssignGames(loader)}
          >
            <Gamepad2 className="h-4 w-4" />
          </Button>
        )}
        {canUploadFiles && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUploadFiles(loader)}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
        {(canViewNotifications || canCreateNotifications || canEditNotifications) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNotificationsGame(loader)}
          >
            <Bell className="h-4 w-4" />
          </Button>
        )}
        {(canViewChangelog || canCreateChangelog || canEditChangelog) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChangelogGame(loader)}
          >
            <GitCommit className="h-4 w-4" />
          </Button>
        )}
        {canManageStatus && (
          <Select
            value={loader.status}
            onValueChange={(value) => onStatusChange(loader.id, value as Loader['status'])}
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
            </SelectContent>
          </Select>
        )}
        {canDeleteLoaders && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDeleteLoader(loader.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

LoaderItem.displayName = 'LoaderItem';

interface LoadersListProps {
  loaders: Loader[];
  games: Game[];
  selectedLoaders: number[];
  onToggleLoaderSelection: (loaderId: number) => void;
  onViewDetails: (loader: Loader) => void;
  onEditLoader: (loader: Loader) => void;
  onConfigLoader: (loader: Loader) => void;
  onAssignGames: (loader: Loader) => void;
  onUploadFiles: (loader: Loader) => void;
  onNotificationsGame: (loader: Loader) => void;
  onChangelogGame: (loader: Loader) => void;
  onStatusChange: (loaderId: number, newStatus: Loader['status']) => void;
  onDeleteLoader: (loaderId: number) => void;
  canEditLoaders: boolean;
  canDeleteLoaders: boolean;
  canUploadFiles: boolean;
  canViewNotifications: boolean;
  canCreateNotifications: boolean;
  canEditNotifications: boolean;
  canViewChangelog: boolean;
  canCreateChangelog: boolean;
  canEditChangelog: boolean;
  canManageStatus: boolean;
  canAssignGames: boolean;
  canConfigurationSettings: boolean;
}

const LoadersList: React.FC<LoadersListProps> = ({
  loaders,
  games,
  selectedLoaders,
  onToggleLoaderSelection,
  onViewDetails,
  onEditLoader,
  onConfigLoader,
  onAssignGames,
  onUploadFiles,
  onNotificationsGame,
  onChangelogGame,
  onStatusChange,
  onDeleteLoader,
  canEditLoaders,
  canDeleteLoaders,
  canUploadFiles,
  canViewNotifications,
  canCreateNotifications,
  canEditNotifications,
  canViewChangelog,
  canCreateChangelog,
  canEditChangelog,
  canManageStatus,
  canAssignGames,
  canConfigurationSettings,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = loaders.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? loaders.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className="divide-y">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const loader = loaders[virtualRow.index];
              return (
                <div
                  key={loader.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LoaderItem
                    loader={loader}
                    games={games}
                    isSelected={selectedLoaders.includes(loader.id)}
                    onToggleSelection={onToggleLoaderSelection}
                    onViewDetails={onViewDetails}
                    onEditLoader={onEditLoader}
                    onConfigLoader={onConfigLoader}
                    onAssignGames={onAssignGames}
                    onUploadFiles={onUploadFiles}
                    onNotificationsGame={onNotificationsGame}
                    onChangelogGame={onChangelogGame}
                    onStatusChange={onStatusChange}
                    onDeleteLoader={onDeleteLoader}
                    canEditLoaders={canEditLoaders}
                    canDeleteLoaders={canDeleteLoaders}
                    canUploadFiles={canUploadFiles}
                    canViewNotifications={canViewNotifications}
                    canCreateNotifications={canCreateNotifications}
                    canEditNotifications={canEditNotifications}
                    canViewChangelog={canViewChangelog}
                    canCreateChangelog={canCreateChangelog}
                    canEditChangelog={canEditChangelog}
                    canManageStatus={canManageStatus}
                    canAssignGames={canAssignGames}
                    canConfigurationSettings={canConfigurationSettings}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {loaders.map((loader) => (
        <LoaderItem
          key={loader.id}
          loader={loader}
          games={games}
          isSelected={selectedLoaders.includes(loader.id)}
          onToggleSelection={onToggleLoaderSelection}
          onViewDetails={onViewDetails}
          onEditLoader={onEditLoader}
          onConfigLoader={onConfigLoader}
          onAssignGames={onAssignGames}
          onUploadFiles={onUploadFiles}
          onNotificationsGame={onNotificationsGame}
          onChangelogGame={onChangelogGame}
          onStatusChange={onStatusChange}
          onDeleteLoader={onDeleteLoader}
          canEditLoaders={canEditLoaders}
          canDeleteLoaders={canDeleteLoaders}
          canUploadFiles={canUploadFiles}
          canViewNotifications={canViewNotifications}
          canCreateNotifications={canCreateNotifications}
          canEditNotifications={canEditNotifications}
          canViewChangelog={canViewChangelog}
          canCreateChangelog={canCreateChangelog}
          canEditChangelog={canEditChangelog}
          canManageStatus={canManageStatus}
          canAssignGames={canAssignGames}
          canConfigurationSettings={canConfigurationSettings}
        />
      ))}
    </div>
  );
};

interface LoaderManagerProps {
  onCreateLoaderRequested?: boolean;
  onCreateLoaderRequestHandled?: () => void;
}

const LoaderManager: React.FC<LoaderManagerProps> = ({ onCreateLoaderRequested, onCreateLoaderRequestHandled }) => {
  const { isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();

  const canViewLoaders = hasPermission('loaders.view');
  const canCreateLoaders = hasPermission('loaders.create');
  const canEditLoaders = hasPermission('loaders.edit');
  const canDeleteLoaders = hasPermission('loaders.delete');
  const canUploadFiles = hasPermission('loaders.upload_files');
  const canViewNotifications = hasPermission('loaders.notifications_view');
  const canCreateNotifications = hasPermission('loaders.notifications_create');
  const canEditNotifications = hasPermission('loaders.notifications_edit');
  const canDeleteNotifications = hasPermission('loaders.notifications_delete');
  const canViewChangelog = hasPermission('loaders.changelog_view');
  const canCreateChangelog = hasPermission('loaders.changelog_create');
  const canEditChangelog = hasPermission('loaders.changelog_edit');
  const canDeleteChangelog = hasPermission('loaders.changelog_delete');
  const canManageStatus = hasPermission('loaders.status');
  const canAssignGames = hasPermission('loaders.assign_games');
  const canConfigurationSettings = hasPermission('loaders.configuration_settings');

  const {
    loaders,
    games,
    loading,
    error,
    stats,
    statsLoading,
    createLoader: createLoaderMutation,
    updateLoader: updateLoaderMutation,
    deleteLoader: deleteLoaderMutation,
    updateStatus: updateStatusMutation,
    assignGames: assignGamesMutation,
    unassignGames: unassignGamesMutation,
    refetch,
    refetchStats,
  } = useLoadersQuery();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLoaders, setSelectedLoaders] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState<Loader | null>(null);
  const [uploadFilesDialogOpen, setUploadFilesDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assignGamesDialogOpen, setAssignGamesDialogOpen] = useState(false);
  const [createGameDialogOpen, setCreateGameDialogOpen] = useState(false);

  if (!canViewLoaders) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view loaders.</p>
      </Card>
    );
  }

  React.useEffect(() => {
    if (onCreateLoaderRequested) {
      setCreateDialogOpen(true);
      onCreateLoaderRequestHandled?.();
    }
  }, [onCreateLoaderRequested, onCreateLoaderRequestHandled]);

  const toggleLoaderSelection = (loaderId: number) => {
    setSelectedLoaders(prev => prev.includes(loaderId) ? prev.filter(id => id !== loaderId) : [...prev, loaderId]);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedLoaders.length === 0) return;

    try {
      const actions = selectedLoaders.map(loaderId => {
        switch (bulkAction) {
          case 'activate':
            return updateStatusMutation(loaderId, 'active');
          case 'deactivate':
            return updateStatusMutation(loaderId, 'inactive');
          case 'maintenance':
            return updateStatusMutation(loaderId, 'maintenance');
          case 'testing':
            return updateStatusMutation(loaderId, 'testing');
          case 'delete':
            return deleteLoaderMutation(loaderId);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(actions);

      setSelectedLoaders([]);
      setBulkAction('');

    } catch (err) {

    }
  };

  const handleStatusChange = async (loaderId: number, newStatus: Loader['status']) => {
    try {
      await updateStatusMutation(loaderId, newStatus);

    } catch (err) {

    }
  };

  const handleDeleteLoader = async (loaderId: number) => {
    if (!confirm('Are you sure you want to delete this loader?')) return;

    try {
      await deleteLoaderMutation(loaderId);

    } catch (err) {

    }
  };

  const handleDownloadLoader = async (loaderId: number) => {
    try {
      const response = await recordLoaderDownload(loaderId);
      if (response.success && response.download_url) {

        const link = document.createElement('a');
        link.href = response.download_url;
        link.download = response.filename || 'loader';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('Download started');

        refetch();
      }
    } catch (err) {
      toast.error('Failed to download loader.');

    }
  };

  const handleEditLoader = (loader: Loader) => {
    setSelectedLoader(loader);
    setEditDialogOpen(true);
  };

  const handleUploadFiles = (loader: Loader) => {
    setSelectedLoader(loader);
    setUploadFilesDialogOpen(true);
  };

  const handleViewDetails = (loader: Loader) => {
    setSelectedLoader(loader);
    setDetailsDialogOpen(true);
  };

  const handleConfigLoader = (loader: Loader) => {
    setSelectedLoader(loader);
    setConfigDialogOpen(true);
  };

  const handleAssignGames = (loader: Loader) => {
    setSelectedLoader(loader);
    setAssignGamesDialogOpen(true);
  };

  const handleNotificationsGame = (loader: Loader) => {
    setSelectedLoader(loader);

  };

  const handleChangelogGame = (loader: Loader) => {
    setSelectedLoader(loader);

  };

  const filteredLoaders = useMemo(() => {
    return loaders.filter(loader => {
      const searchMatch = loader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (loader.description && loader.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const statusMatch = statusFilter === 'all' || loader.status === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [loaders, searchTerm, statusFilter]);

  const allSelected = selectedLoaders.length === filteredLoaders.length && filteredLoaders.length > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedLoaders([]);
    } else {
      setSelectedLoaders(filteredLoaders.map(l => l.id));
    }
  };

  const clearSelection = () => {
    setSelectedLoaders([]);
  };

  if (error) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Loaders</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!loading && filteredLoaders.length === 0 && loaders.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Container className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Loaders Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Get started by creating your first loader. You can manage settings, upload files, and track usage.
              </p>
              <div className="flex gap-2 justify-center">
                <ConditionalRender permission="games.create" fallback={null}>
                  <Button 
                    onClick={() => setCreateGameDialogOpen(true)}
                    variant="outline"
                    className="gap-2"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create Application
                  </Button>
                </ConditionalRender>
                {canCreateLoaders && (
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-2"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create First Loader
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Loaders</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {filteredLoaders.length} {filteredLoaders.length === 1 ? 'loader' : 'loaders'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={refetch}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ConditionalRender permission="loaders.create" fallback={null}>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
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
                  placeholder="Search loaders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select 
                value={statusFilter} 
                onValueChange={setStatusFilter}
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
            {selectedLoaders.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Selected: {selectedLoaders.length} {selectedLoaders.length === 1 ? 'loader' : 'loaders'}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <ConditionalRender 
                    permissions={['loaders.status', 'loaders.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <ConditionalRender permission="loaders.status" fallback={null}>
                          <SelectItem value="activate">Activate</SelectItem>
                          <SelectItem value="deactivate">Deactivate</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                        </ConditionalRender>
                        <ConditionalRender permission="loaders.delete" fallback={null}>
                          <SelectItem value="delete">Delete</SelectItem>
                        </ConditionalRender>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkAction} 
                      disabled={!bulkAction || (!canManageStatus && !canDeleteLoaders)} 
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
              <Spinner message="Loading loaders..." />
            ) : filteredLoaders.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Container className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <div className="text-sm text-muted-foreground">No loaders found</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredLoaders.length === 0}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                </div>
                <LoadersList
                  loaders={filteredLoaders}
                  games={games}
                  selectedLoaders={selectedLoaders}
                  onToggleLoaderSelection={toggleLoaderSelection}
                  onViewDetails={handleViewDetails}
                  onEditLoader={handleEditLoader}
                  onConfigLoader={handleConfigLoader}
                  onAssignGames={handleAssignGames}
                  onUploadFiles={handleUploadFiles}
                  onNotificationsGame={handleNotificationsGame}
                  onChangelogGame={handleChangelogGame}
                  onStatusChange={handleStatusChange}
                  onDeleteLoader={handleDeleteLoader}
                  canEditLoaders={canEditLoaders}
                  canDeleteLoaders={canDeleteLoaders}
                  canUploadFiles={canUploadFiles}
                  canViewNotifications={canViewNotifications}
                  canCreateNotifications={canCreateNotifications}
                  canEditNotifications={canEditNotifications}
                  canViewChangelog={canViewChangelog}
                  canCreateChangelog={canCreateChangelog}
                  canEditChangelog={canEditChangelog}
                  canManageStatus={canManageStatus}
                  canAssignGames={canAssignGames}
                  canConfigurationSettings={canConfigurationSettings}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {}
      {canCreateLoaders && (
        <CreateLoaderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}

      {}
      {canEditLoaders && (
        <EditLoaderDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
          loader={selectedLoader}
        />
      )}

      {}
      {canUploadFiles && (
        <UploadLoaderFilesDialog
          open={uploadFilesDialogOpen}
          onOpenChange={setUploadFilesDialogOpen}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
          loader={selectedLoader}
        />
      )}

      {}
      <LoaderDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loader={selectedLoader}
        games={games}
      />

      {}
      {canConfigurationSettings && (
        <LoaderConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
          loader={selectedLoader}
        />
      )}

      {}
      {canAssignGames && (
        <AssignGamesDialog
        open={assignGamesDialogOpen}
        onOpenChange={setAssignGamesDialogOpen}
        loader={selectedLoader}
        onAssign={async (loaderId, gameIds) => {
          try {
            await assignGamesMutation(loaderId, gameIds);

          } catch (error) {

          }
        }}
        onUnassign={async (loaderId, gameIds) => {
          try {
            await unassignGamesMutation(loaderId, gameIds);

          } catch (error) {

          }
        }}
        />
      )}

      {}
      <CreateGameDialog
        open={createGameDialogOpen}
        onOpenChange={setCreateGameDialogOpen}
        onSuccess={() => {
          refetch();
          refetchStats();
        }}
      />
    </div>
  );
};

export default LoaderManager;