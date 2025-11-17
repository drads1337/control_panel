import { useMemo, useState, useCallback } from 'react';
import type { Game } from '@/entities/game';

export interface GameFilters {
  searchTerm: string;
  status: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing';
  sortBy: 'name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}

const defaultFilters: GameFilters = {
  searchTerm: '',
  status: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
};

/**
 * Hook for managing game filtering and sorting logic
 * Separates filtering logic from UI components
 */
export function useGameFilters(games: Game[]) {
  const [filters, setFilters] = useState<GameFilters>(defaultFilters);

  const updateFilters = useCallback((newFilters: Partial<GameFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const filteredGames = useMemo(() => {
    let result = [...games];

    // Filter by search term
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (game) =>
          game.name.toLowerCase().includes(searchLower) ||
          game.description?.toLowerCase().includes(searchLower) ||
          game.id.toString().includes(searchLower)
      );
    }

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter((game) => game.status === filters.status);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison =
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
          comparison =
            new Date(a.updated_at || 0).getTime() -
            new Date(b.updated_at || 0).getTime();
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [games, filters]);

  return {
    filters,
    filteredGames,
    updateFilters,
    resetFilters,
  };
}

