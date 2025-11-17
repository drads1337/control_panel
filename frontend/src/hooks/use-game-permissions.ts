import { useMemo, useEffect, useState } from 'react';
import { usePermissions } from './use-permissions';
import { getGames } from '@/entities/game';

/**
 * Hook for managing game-related permissions
 * Separates permission logic from UI components
 * 
 * Note: canViewGames can be true even without global games.view permission
 * if user has access to specific games via game_id (through keys permissions)
 */
export function useGamePermissions() {
  const { hasPermission } = usePermissions();
  const [gamesCount, setGamesCount] = useState<number | null>(null);
  const hasGlobalGamesView = hasPermission('games.view');
  const hasKeysPermission = hasPermission('keys.view') || hasPermission('keys.create');

  // Load games count to check if user has access to games (even without global games.view)
  useEffect(() => {
    const loadGamesCount = async () => {
      // If user already has games.view permission, no need to check
      if (hasGlobalGamesView) {
        setGamesCount(1); // Set to 1 to indicate games are available
        return;
      }

      // If user has keys.create or keys.view, they might have access to specific games
      if (hasKeysPermission) {
        try {
          const response = await getGames('all');
          if (response.success && response.games) {
            setGamesCount(response.games.length);
          } else {
            setGamesCount(0);
          }
        } catch (error) {
          console.error('Error loading games for permission check:', error);
          setGamesCount(0);
        }
      } else {
        setGamesCount(0);
      }
    };

    loadGamesCount();
  }, [hasGlobalGamesView, hasKeysPermission]);

  // Calculate effective canViewGames - user has access if:
  // 1. Has global games.view permission, OR
  // 2. Has keys permission and at least one game is available
  const effectiveCanViewGames = useMemo(() => {
    if (hasGlobalGamesView) return true;
    if (hasKeysPermission && gamesCount !== null && gamesCount > 0) return true;
    return false;
  }, [hasGlobalGamesView, hasKeysPermission, gamesCount]);

  const permissions = useMemo(
    () => ({
      canViewGames: effectiveCanViewGames,
      canCreateGames: hasPermission('games.create'),
      canEditGames: hasPermission('games.edit'),
      canDeleteGames: hasPermission('games.delete'),
      canUploadFiles: hasPermission('games.upload_files'),
      canManagePrices: hasPermission('games.manage_prices'),
      canManageChangelog: hasPermission('games.changelog_view'),
      canManageNotifications: hasPermission('games.notifications_view'),
      canManageStatus: hasPermission('games.status'),
    }),
    [effectiveCanViewGames, hasPermission]
  );

  return permissions;
}

