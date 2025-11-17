import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Zap, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Upload, Image, 
  FileText, Globe, Bell, MessageSquare, Star, Activity, Download, Eye, 
  Send, Clock, Package, HardDrive, Search, Filter, Users, Settings, 
  Play, Pause, Power, Shield, Cpu, Gamepad2, GitCommit
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
  
  // Use React Query hook for server state management
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
  
  // Check access
  if (!canViewLoaders) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view loaders.</p>
      </Card>
    );
  }

  // Handle external create loader request from parent
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
      
      // Data will be automatically refetched via React Query cache invalidation
    } catch (err) {
      console.error('Bulk action error:', err);
    }
  };

  const handleStatusChange = async (loaderId: number, newStatus: Loader['status']) => {
    try {
      await updateStatusMutation(loaderId, newStatus);
      // Data and stats will be automatically refetched via React Query cache invalidation
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleDeleteLoader = async (loaderId: number) => {
    if (!confirm('Are you sure you want to delete this loader?')) return;
    
    try {
      await deleteLoaderMutation(loaderId);
      // Data and stats will be automatically refetched via React Query cache invalidation
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDownloadLoader = async (loaderId: number) => {
    try {
      const response = await recordLoaderDownload(loaderId);
      if (response.success && response.download_url) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.download_url;
        link.download = response.filename || 'loader';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download started');
        
        // Refetch to update download count
        refetch();
      }
    } catch (err) {
      toast.error('Failed to download loader.');
      console.error('Download error:', err);
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
    // TODO: Open notifications dialog
  };

  const handleChangelogGame = (loader: Loader) => {
    setSelectedLoader(loader);
    // TODO: Open changelog dialog
  };

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>
        {getStatusText(statusType)}
      </span>
    );
  };

  const filteredLoaders = loaders.filter(loader => {
    const searchMatch = loader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       loader.description.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || loader.status === statusFilter;
    return searchMatch && statusMatch;
  });


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
    <div className="space-y-6">

      {/* Bulk Actions - only show when there are loaders and some are selected */}
      {loaders.length > 0 && selectedLoaders.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedLoaders.length} selected
          </span>
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
          <Button onClick={handleBulkAction} disabled={!bulkAction || (!canManageStatus && !canDeleteLoaders)} size="sm">
            Apply
          </Button>
          <Button variant="ghost" onClick={() => setSelectedLoaders([])} size="sm">
            Clear
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredLoaders.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Applications Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Get started by creating your first application. You can manage settings, upload files, and track usage.
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
        /* Loaders Table */
        <>
          {loading ? (
            <div className="p-8">
              <Spinner message="Loading loaders..." />
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedLoaders.length === filteredLoaders.length && filteredLoaders.length > 0}
                        onChange={(e) => e.target.checked ? setSelectedLoaders(filteredLoaders.map(l => l.id)) : setSelectedLoaders([])}
                      />
                    </TableHead>
                    <TableHead className="font-semibold text-left">Loader</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                    <TableHead className="font-semibold text-center">Version</TableHead>
                    <TableHead className="font-semibold text-center">Downloads</TableHead>
                    <TableHead className="font-semibold text-center">Users</TableHead>
                    <TableHead className="font-semibold text-center">Games</TableHead>
                    <TableHead className="font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoaders.map((loader) => (
                    <TableRow key={loader.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedLoaders.includes(loader.id)}
                          onChange={() => toggleLoaderSelection(loader.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            {loader.logo ? (
                              <img src={loader.logo} alt={loader.name} className="w-8 h-8 rounded" />
                            ) : (
                              <Zap className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{loader.name}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {loader.description || 'No description provided'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              ID: {loader.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(loader.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-medium">
                          v{loader.version}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          <div className="font-semibold">{loader.downloads.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">downloads</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          <div className="font-semibold">{loader.active_users.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">active users</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          <div className="font-semibold">{loader.assigned_games.length}</div>
                          <div className="text-xs text-muted-foreground">games</div>
                          {loader.assigned_games.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {loader.assigned_games.map(gameId => 
                                games.find(g => g.id === gameId)?.name
                              ).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDetails(loader)}
                            title="View details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditLoaders && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditLoader(loader)}
                              title="Edit Loader"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canConfigurationSettings && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleConfigLoader(loader)}
                              title="Configure Loader"
                              className="h-8 w-8 p-0"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                          {canAssignGames && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleAssignGames(loader)}
                              title="Manage Games"
                              className="h-8 w-8 p-0"
                            >
                              <Gamepad2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canUploadFiles && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleUploadFiles(loader)}
                              title="Upload files"
                              className="h-8 w-8 p-0"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          {(canViewNotifications || canCreateNotifications || canEditNotifications) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleNotificationsGame(loader)}
                              title="Manage notifications"
                              className="h-8 w-8 p-0"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          {(canViewChangelog || canCreateChangelog || canEditChangelog) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleChangelogGame(loader)}
                              title="Manage changelog"
                              className="h-8 w-8 p-0"
                            >
                              <GitCommit className="h-4 w-4" />
                            </Button>
                          )}
                          <ConditionalRender permission="loaders.status" fallback={null}>
                            <Select value={loader.status} onValueChange={(value) => {
                              handleStatusChange(loader.id, value as Loader['status']);
                            }}>
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
                          </ConditionalRender>
                          {canDeleteLoaders && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteLoader(loader.id)}
                              title="Delete loader"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}


      {/* Create Loader Dialog */}
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

      {/* Edit Loader Dialog */}
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

      {/* Upload Files Dialog */}
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

      {/* Loader Details Dialog */}
      <LoaderDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loader={selectedLoader}
        games={games}
      />

      {/* Loader Config Dialog */}
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

      {/* Assign Games Dialog */}
      {canAssignGames && (
        <AssignGamesDialog
        open={assignGamesDialogOpen}
        onOpenChange={setAssignGamesDialogOpen}
        loader={selectedLoader}
        onAssign={async (loaderId, gameIds) => {
          try {
            await assignGamesMutation(loaderId, gameIds);
            // Data will be automatically refetched via React Query cache invalidation
          } catch (error) {
            console.error('Failed to assign games:', error);
          }
        }}
        onUnassign={async (loaderId, gameIds) => {
          try {
            await unassignGamesMutation(loaderId, gameIds);
            // Data will be automatically refetched via React Query cache invalidation
          } catch (error) {
            console.error('Failed to unassign games:', error);
          }
        }}
        />
      )}

      {/* Create Game Dialog */}
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