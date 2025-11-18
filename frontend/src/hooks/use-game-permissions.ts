import { useMemo, useEffect, useState } from 'react';
import { usePermissions } from './use-permissions';
import { getGames } from '@/entities/game';

export function useGamePermissions() {
  const { hasPermission } = usePermissions();
  const [gamesCount, setGamesCount] = useState<number | null>(null);
  const hasGlobalGamesView = hasPermission('games.view');
  const hasKeysPermission = hasPermission('keys.view') || hasPermission('keys.create');

  useEffect(() => {
    const loadGamesCount = async () => {

      if (hasGlobalGamesView) {
        setGamesCount(1);
        return;
      }

      if (hasKeysPermission) {
        try {
          const response = await getGames('all');
          if (response.success && response.games) {
            setGamesCount(response.games.length);
          } else {
            setGamesCount(0);
          }
        } catch (error) {

          setGamesCount(0);
        }
      } else {
        setGamesCount(0);
      }
    };

    loadGamesCount();
  }, [hasGlobalGamesView, hasKeysPermission]);

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
