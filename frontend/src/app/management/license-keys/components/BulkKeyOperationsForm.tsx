import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { useKeyForm } from '../hooks/use-key-form';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { 
  bulkDeleteKeysByFilters, 
  bulkResetKeysByFilters, 
  bulkExtendKeysByFilters,
  getKeysCountByFilters,
  bulkPauseKeys,
  bulkActivateKeys,
  bulkAddHoursToKeys,
  bulkPauseLoaderKeys,
  bulkActivateLoaderKeys,
  bulkAddHoursToLoaderKeys
} from '@/entities/key/api/bulk';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/api/enhanced-client';
import {
  TargetTypeSelector,
  GameSelector,
  LoaderSelector,
  AdvancedFilters,
  FilteredOperations,
  QuickOperations,
  type FilterState,
} from './BulkOperations';

interface BulkKeyOperationsFormProps {
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  loaders: Array<{ id: number; name: string; assigned_games: number[] }>;
  loadersLoading: boolean;
  onOperationComplete: () => void;
  canViewGames: boolean;
  canViewLoaders: boolean;
}

export const BulkKeyOperationsForm: React.FC<BulkKeyOperationsFormProps> = ({
  games,
  loaders,
  loadersLoading,
  onOperationComplete,
  canViewGames,
  canViewLoaders,
}) => {
  const showTargetTypeToggle = canViewGames && canViewLoaders;
  
  // Determine initial target type based on permissions
  const getInitialTargetType = () => {
    if (canViewGames && !canViewLoaders) return 'game';
    if (canViewLoaders && !canViewGames) return 'loader';
    return 'game'; // Default to game if both or neither
  };
  
  const {
    formData,
    updateField,
    getGameLibraryGames,
    getAssignedGamesForLoader,
  } = useKeyForm({
    games,
    loaders,
    initialTargetType: getInitialTargetType(),
  });
  
  // Ensure targetType matches available permissions
  useEffect(() => {
    if (!showTargetTypeToggle) {
      if (canViewGames && !canViewLoaders && formData.targetType !== 'game') {
        updateField('targetType', 'game');
      } else if (canViewLoaders && !canViewGames && formData.targetType !== 'loader') {
        updateField('targetType', 'loader');
      }
    }
  }, [showTargetTypeToggle, canViewGames, canViewLoaders, formData.targetType, updateField]);

  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);
  const [keysCount, setKeysCount] = useState<number | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    activationStatus: 'all',
    deviceUsage: 'all',
    maxDevices: 'all',
    dateRange: 'all',
    customDateFrom: '',
    customDateTo: ''
  });

  const buildFilters = () => {
    const filterParams: any = {};
    
    if (formData.targetType === 'game' && formData.gameId) {
      filterParams.game_id = parseInt(formData.gameId);
    } else if (formData.targetType === 'loader' && formData.loaderId && formData.selectedGames.length > 0) {
      filterParams.loader_id = parseInt(formData.loaderId);
      filterParams.game_ids = formData.selectedGames;
    }
    
    if (filters.status !== 'all') {
      filterParams.status = filters.status;
    }
    if (filters.activationStatus !== 'all') {
      filterParams.activation_status = filters.activationStatus;
    }
    if (filters.deviceUsage !== 'all') {
      filterParams.device_usage = filters.deviceUsage;
    }
    if (filters.maxDevices !== 'all') {
      filterParams.max_devices = filters.maxDevices;
    }
    if (filters.dateRange === 'custom') {
      if (filters.customDateFrom) filterParams.date_from = filters.customDateFrom;
      if (filters.customDateTo) filterParams.date_to = filters.customDateTo;
    } else if (filters.dateRange !== 'all') {
      // Handle predefined date ranges if needed
    }
    
    return filterParams;
  };

  const handleGetCount = async () => {
    setBulkActionLoading('count');
    try {
      const filterParams = buildFilters();
      const result = await getKeysCountByFilters(filterParams);
      setKeysCount(result.count);
      toast.success(`Found ${result.count} keys matching the criteria`);
    } catch (error) {
      console.error('Error getting key count:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }
    
    setBulkActionLoading('delete');
    try {
      const filterParams = buildFilters();
      const result = await bulkDeleteKeysByFilters(filterParams);
      toast.success(result.message || `Deleted ${result.deleted_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      console.error('Error deleting keys:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkReset = async () => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }
    
    setBulkActionLoading('reset');
    try {
      const filterParams = buildFilters();
      const result = await bulkResetKeysByFilters(filterParams);
      toast.success(result.message || `Reset ${result.reset_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      console.error('Error resetting keys:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkExtend = async (hours: number = 24) => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }
    
    setBulkActionLoading('extend');
    try {
      const filterParams = buildFilters();
      const result = await bulkExtendKeysByFilters(hours, filterParams);
      toast.success(result.message || `Extended ${result.extended_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      console.error('Error extending keys:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleQuickOperation = async (action: 'pause' | 'activate' | 'addHours') => {
    if (formData.targetType === 'game' && !formData.gameId) {
      toast.error('Please select a game');
      return;
    }
    if (formData.targetType === 'loader' && (!formData.loaderId || formData.selectedGames.length === 0)) {
      toast.error('Please select a loader and games');
      return;
    }
    
    setBulkActionLoading(action);
    try {
      if (formData.targetType === 'game' && formData.gameId) {
        switch (action) {
          case 'pause':
            await bulkPauseKeys(parseInt(formData.gameId));
            break;
          case 'activate':
            await bulkActivateKeys(parseInt(formData.gameId));
            break;
          case 'addHours':
            await bulkAddHoursToKeys(parseInt(formData.gameId), 24);
            break;
        }
        toast.success(`Bulk ${action} operation completed`);
        onOperationComplete();
      } else {
        // For loader, use loader-specific bulk operations
        if (formData.loaderId && formData.selectedGames && formData.selectedGames.length > 0) {
          switch (action) {
            case 'pause':
              await bulkPauseLoaderKeys(parseInt(formData.loaderId), formData.selectedGames);
              break;
            case 'activate':
              await bulkActivateLoaderKeys(parseInt(formData.loaderId), formData.selectedGames);
              break;
            case 'addHours':
              await bulkAddHoursToLoaderKeys(parseInt(formData.loaderId), formData.selectedGames, 24);
              break;
          }
          toast.success(`Bulk ${action} operation completed for ${formData.selectedGames.length} games`);
          onOperationComplete();
        }
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const isTargetSelected = (formData.targetType === 'game' && formData.gameId) || 
                          (formData.targetType === 'loader' && formData.loaderId && formData.selectedGames.length > 0);

  return (
    <ConditionalRender permission="keys.generate" fallback={null}>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Bulk Key Operations</CardTitle>
          </div>
          <CardDescription>
            Perform actions on multiple keys at once based on filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow">
          {/* Target Type Selection */}
          {showTargetTypeToggle && (
            <TargetTypeSelector
              value={formData.targetType}
              onChange={(value) => updateField('targetType', value)}
            />
          )}

          {/* Game/Loader Selection */}
          {(formData.targetType === 'game' && canViewGames) || (canViewGames && !canViewLoaders) ? (
            <GameSelector
              games={getGameLibraryGames()}
              value={formData.gameId}
              onChange={(value) => updateField('gameId', value)}
            />
          ) : ((formData.targetType === 'loader' && canViewLoaders) || (canViewLoaders && !canViewGames)) ? (
            <LoaderSelector
              loaders={loaders}
              loaderId={formData.loaderId}
              selectedGames={formData.selectedGames}
              availableGames={formData.loaderId ? getAssignedGamesForLoader(parseInt(formData.loaderId)) : []}
              loadersLoading={loadersLoading}
              onLoaderChange={(value) => {
                updateField('loaderId', value);
                updateField('selectedGames', []);
              }}
              onGamesChange={(gameIds) => updateField('selectedGames', gameIds)}
            />
          ) : null}

          {/* Filters */}
          <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            onGetCount={handleGetCount}
            keysCount={keysCount}
            isLoading={bulkActionLoading === 'count'}
            disabled={!isTargetSelected}
          />
        </CardContent>
        <CardFooter className="flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Actions will be applied to all keys matching the selected targets above.
          </p>

          {/* Filtered operations */}
          <FilteredOperations
            keysCount={keysCount || 0}
            onDelete={handleBulkDelete}
            onReset={handleBulkReset}
            onExtend={() => handleBulkExtend(24)}
            isLoading={bulkActionLoading !== null}
          />

          {/* Quick operations */}
          <QuickOperations
            onPause={() => handleQuickOperation('pause')}
            onActivate={() => handleQuickOperation('activate')}
            onAddHours={() => handleQuickOperation('addHours')}
            onDelete={handleBulkDelete}
            isLoading={bulkActionLoading !== null}
            disabled={!isTargetSelected}
          />
        </CardFooter>
      </Card>
    </ConditionalRender>
  );
};

