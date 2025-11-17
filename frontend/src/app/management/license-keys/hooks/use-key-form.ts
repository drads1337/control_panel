import { useState, useCallback } from 'react';

export interface KeyFormData {
  targetType: 'game' | 'loader';
  gameId: string;
  loaderId: string;
  selectedGames: number[];
  duration: string;
  customHours: string;
  maxDevices: number;
}

const initialFormData: KeyFormData = {
  targetType: 'game',
  gameId: '',
  loaderId: '',
  selectedGames: [],
  duration: '1mo',
  customHours: '',
  maxDevices: 1,
};

export function useKeyForm({
  games,
  loaders,
  initialTargetType = 'game',
}: {
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  loaders: Array<{ id: number; name: string; assigned_games: number[] }>;
  initialTargetType?: 'game' | 'loader';
}) {
  const [formData, setFormData] = useState<KeyFormData>({
    ...initialFormData,
    targetType: initialTargetType,
  });

  const updateField = useCallback(<K extends keyof KeyFormData>(
    field: K,
    value: KeyFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const reset = useCallback(() => {
    setFormData({
      ...initialFormData,
      targetType: initialTargetType,
    });
  }, [initialTargetType]);

  const getGameLibraryGames = useCallback(() => {
    return games.filter((game) => !game.is_multi_app);
  }, [games]);

  const getAssignedGamesForLoader = useCallback(
    (loaderId: number) => {
      const loader = loaders.find((l) => l.id === loaderId);
      if (!loader) return [];
      return games.filter((game) => loader.assigned_games.includes(game.id));
    },
    [loaders, games]
  );

  return {
    formData,
    updateField,
    reset,
    getGameLibraryGames,
    getAssignedGamesForLoader,
  };
}
