import { useState, useCallback } from 'react';
import { useKeysData } from './use-keys-data';
import { useKeysUI } from './use-keys-ui';
import { getGames } from '@/entities/game';
import type { LicenseKey } from '@/entities/key';

interface UseKeysManagementParams {
  viewMode: 'my' | 'all';
  filters: {
    status: string;
    gameId: string;
    search: string;
  };
  currentPage: number;
  canViewKeys: boolean;
}

interface UseKeysManagementReturn {
  // Data
  keys: LicenseKey[];
  loading: boolean;
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };

  // UI State
  showKey: Record<number, boolean>;
  fullKeys: Record<number, string>; // Full keys cache
  selectedKeys: Set<number>;
  actionLoading: Set<number>;
  selectedKey: LicenseKey | null;
  detailsDialogOpen: boolean;
  editDialogOpen: boolean;
  extendDialogOpen: boolean;

  // Actions
  handleToggleKeyVisibility: (keyId: number) => void;
  handleSelectKey: (keyId: number, selected: boolean) => void;
  handleSelectAll: (selected: boolean) => void;
  handleKeyAction: (action: string, keyId: number) => Promise<void>;
  handleViewDetails: (key: LicenseKey) => void;
  handleKeyCreated: (createdKeyId?: number) => Promise<void>;
  handleDialogSuccess: () => Promise<void>;
  loadGames: () => Promise<void>;
  setDetailsDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setExtendDialogOpen: (open: boolean) => void;
  setSelectedKey: (key: LicenseKey | null) => void;
}

/**
 * Composite hook that combines data and UI management
 * For better separation, consider using useKeysData and useKeysUI directly
 */
export function useKeysManagement({
  viewMode,
  filters,
  currentPage,
  canViewKeys,
}: UseKeysManagementParams): UseKeysManagementReturn {
  const [games, setGames] = useState<Array<{ id: number; name: string; is_multi_app: boolean }>>([]);

  // Use separated hooks
  const keysData = useKeysData({
    viewMode,
    filters,
    currentPage,
    canViewKeys,
  });

  // Wrap loadGames to also update local games state
  const loadGames = useCallback(async () => {
    try {
      const response = await getGames('all');
      setGames(
        response.games.map((game) => ({
          id: game.id,
          name: game.name,
          is_multi_app: game.is_multi_app,
        }))
      );
    } catch (error) {
      console.error('Error loading games:', error);
    }
  }, []);

  const keysUI = useKeysUI({
    keys: keysData.keys as LicenseKey[],
    loadGames,
    invalidateQueries: keysData.invalidateQueries,
  });

  return {
    // Data
    keys: keysData.keys as LicenseKey[],
    loading: keysData.loading,
    games,
    pagination: keysData.pagination,

    // UI State
    ...keysUI,

    // Actions
    loadGames,
  };
}

