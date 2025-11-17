import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useKeysQuery, keyKeys } from '@/hooks/use-keys-query';
import { getGames } from '@/entities/game';

interface UseKeysDataParams {
  viewMode: 'my' | 'all';
  filters: {
    status: string;
    gameId: string;
    search: string;
  };
  currentPage: number;
  canViewKeys: boolean;
}

interface UseKeysDataReturn {
  // Data
  keys: any[];
  loading: boolean;
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };

  // Data actions
  loadGames: () => Promise<void>;
  invalidateQueries: () => void;
}

/**
 * Hook for managing keys data (queries, fetching)
 * Separated from UI state management for better reusability
 */
export function useKeysData({
  viewMode,
  filters,
  currentPage,
  canViewKeys,
}: UseKeysDataParams): UseKeysDataReturn {
  const queryClient = useQueryClient();

  // Use React Query hook for keys
  const showMyKeysOnly = !canViewKeys ? true : viewMode === 'my';
  const keysQuery = useKeysQuery({
    page: currentPage,
    per_page: 20,
    status: filters.status !== 'all' ? filters.status : undefined,
    game_id: filters.gameId !== 'all' ? parseInt(filters.gameId) : undefined,
    search: filters.search || undefined,
    my_keys: showMyKeysOnly,
  });

  // Extract data from query
  const keys = keysQuery.keys || [];
  const loading = keysQuery.loading;
  const pagination = {
    page: keysQuery.currentPage,
    perPage: keysQuery.perPage,
    total: keysQuery.total,
    pages: keysQuery.pages,
  };

  // Load games
  const loadGames = useCallback(async (): Promise<void> => {
    try {
      await getGames('all');
      // This function doesn't set games state - it's just for fetching
      // The caller should handle the state update if needed
    } catch (error) {
      console.error('Error loading games:', error);
      throw error;
    }
  }, []);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keyKeys.lists() });
    queryClient.invalidateQueries({ queryKey: keyKeys.stats() });
  }, [queryClient]);

  return {
    // Data
    keys,
    loading,
    games: [], // Games should be loaded separately or passed as prop
    pagination,

    // Data actions
    loadGames,
    invalidateQueries,
  };
}

