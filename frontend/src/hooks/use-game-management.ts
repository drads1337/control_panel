import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getGames,
  updateGameStatus,
  bulkUpdateGameStatus,
  deleteGame,
  bulkDeleteGames,
  type Game,
} from '@/entities/game';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useMutationWithCache } from './use-mutation-helpers';
import { toast } from 'sonner';

// Cache keys for games
export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (type?: string) => [...gameKeys.lists(), type || 'all'] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: number) => [...gameKeys.details(), id] as const,
};

interface UseGameManagementReturn {
  // Data
  games: Game[];
  loading: boolean;
  error: string | null;

  // UI State
  selectedGames: number[];
  bulkAction: string;
  showCreateDialog: boolean;
  showPricesDialog: boolean;
  showNotificationsDialog: boolean;
  showUploadDialog: boolean;
  showEditDialog: boolean;
  showChangelogDialog: boolean;
  selectedGame: Game | null;
  notification: { message: string; type: 'success' | 'error' } | null;

  // Actions
  fetchGames: () => Promise<void>;
  toggleGameSelection: (gameId: number) => void;
  handleBulkAction: () => Promise<void>;
  handleStatusChange: (gameId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => Promise<void>;
  handleDeleteGame: (gameId: number) => Promise<void>;
  handleViewGame: (game: Game) => void;
  handleEditGame: (game: Game) => void;
  handleUploadGame: (game: Game) => void;
  handleNotificationsGame: (game: Game) => void;
  handlePricesGame: (game: Game) => void;
  handleChangelogGame: (game: Game) => void;
  closeAllDialogs: () => void;

  // Setters
  setBulkAction: (action: string) => void;
  setSelectedGames: (games: number[]) => void;
  setShowCreateDialog: (open: boolean) => void;
  setShowPricesDialog: (open: boolean) => void;
  setShowNotificationsDialog: (open: boolean) => void;
  setShowUploadDialog: (open: boolean) => void;
  setShowEditDialog: (open: boolean) => void;
  setShowChangelogDialog: (open: boolean) => void;
  setSelectedGame: (game: Game | null) => void;
  setNotification: (notification: { message: string; type: 'success' | 'error' } | null) => void;
}

export function useGameManagement(onViewGame?: (game: Game) => void, onCreateGame?: () => void): UseGameManagementReturn {
  const { isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();

  const canManageStatus = hasPermission('games.status');
  const canDeleteGames = hasPermission('games.delete');

  // UI State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedGames, setSelectedGames] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Fetch games with React Query
  const {
    data: gamesData,
    isLoading,
    error: gamesError,
    refetch,
  } = useQuery({
    queryKey: gameKeys.list('all'),
    queryFn: async () => {
      console.log('🎮 fetchGames: Starting fetch...');
      const response = await getGames('all');
      console.log('🎮 fetchGames: Received response:', response);
      console.log('🎮 fetchGames: Games data:', response.games);
      console.log('🎮 fetchGames: Setting games, count:', response.games?.length || 0);
      response.games.forEach((game) => {
        console.log(`🎮 Game ${game.id} (${game.name}): login_type = ${game.login_type}`);
      });
      return response.games || [];
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const games = gamesData || [];
  const loading = isLoading;
  const error = gamesError
    ? (gamesError as any)?.message || 'Failed to fetch games'
    : null;

  // Handle external create game trigger - removed window object usage
  // Use onCreateGameRequested prop instead

  const toggleGameSelection = useCallback((gameId: number) => {
    setSelectedGames((prev) => (prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]));
  }, []);

  // Mutations with automatic cache invalidation
  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ gameId, status }: { gameId: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateGameStatus(gameId, status),
    invalidateQueries: [gameKeys.lists()],
    successMessage: 'Game status successfully updated!',
    errorMessage: 'Error updating status.',
  });

  const bulkUpdateStatusMutation = useMutationWithCache({
    mutationFn: ({ gameIds, status }: { gameIds: number[]; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      bulkUpdateGameStatus(gameIds, status),
    invalidateQueries: [gameKeys.lists()],
    onSuccess: (_, variables) => {
      toast.success(`Status of ${variables.gameIds.length} games successfully updated!`)
    },
    errorMessage: 'Error performing bulk action.',
  });

  const deleteGameMutation = useMutationWithCache({
    mutationFn: (gameId: number) => deleteGame(gameId),
    invalidateQueries: [gameKeys.lists()],
    successMessage: 'Game successfully deleted!',
    errorMessage: 'Error deleting game.',
  });

  const bulkDeleteGamesMutation = useMutationWithCache({
    mutationFn: (gameIds: number[]) => bulkDeleteGames(gameIds),
    invalidateQueries: [gameKeys.lists()],
    onSuccess: (_, variables) => {
      toast.success(`Successfully deleted ${variables.length} games!`)
    },
    errorMessage: 'Error performing bulk action.',
  });

  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedGames.length === 0 || !isAuthenticated) return;

    try {
      if (bulkAction === 'delete') {
        await bulkDeleteGamesMutation.mutateAsync(selectedGames);
      } else {
        const status = bulkAction as 'active' | 'inactive' | 'maintenance' | 'testing';
        await bulkUpdateStatusMutation.mutateAsync({ gameIds: selectedGames, status });
      }

      setSelectedGames([]);
      setBulkAction('');
    } catch (err) {
      // Error is handled by mutation
      console.error('Bulk action error:', err);
    }
  }, [bulkAction, selectedGames, isAuthenticated, bulkDeleteGamesMutation, bulkUpdateStatusMutation]);

  const handleStatusChange = useCallback(
    async (gameId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated) return;

      try {
        await updateStatusMutation.mutateAsync({ gameId, status: newStatus });
      } catch (err) {
        // Error is handled by mutation
        console.error('Status update error:', err);
      }
    },
    [isAuthenticated, updateStatusMutation]
  );

  const handleDeleteGame = useCallback(
    async (gameId: number) => {
      if (!isAuthenticated) return;

      if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
        return;
      }

      try {
        await deleteGameMutation.mutateAsync(gameId);
      } catch (err) {
        // Error is handled by mutation
        console.error('Delete game error:', err);
      }
    },
    [isAuthenticated, deleteGameMutation]
  );

  // Action handlers
  const handleViewGame = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      onViewGame?.(game); // Call the prop
    },
    [onViewGame]
  );

  const handleEditGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setShowEditDialog(true);
  }, []);

  const handleUploadGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setShowUploadDialog(true);
  }, []);

  const handleNotificationsGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setShowNotificationsDialog(true);
  }, []);

  const handlePricesGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setShowPricesDialog(true);
  }, []);

  const handleChangelogGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setShowChangelogDialog(true);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setShowEditDialog(false);
    setShowUploadDialog(false);
    setShowNotificationsDialog(false);
    setShowPricesDialog(false);
    setShowCreateDialog(false);
    setShowChangelogDialog(false);
    setSelectedGame(null);
  }, []);

  return {
    // Data
    games,
    loading,
    error,

    // UI State
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

    // Actions
    fetchGames: async () => {
      await refetch()
    },
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

    // Setters
    setBulkAction,
    setSelectedGames,
    setShowCreateDialog,
    setShowPricesDialog,
    setShowNotificationsDialog,
    setShowUploadDialog,
    setShowEditDialog,
    setShowChangelogDialog,
    setSelectedGame,
    setNotification,
  };
}

