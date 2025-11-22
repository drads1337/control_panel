import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FileItem } from '@/entities/file';

const FILTERS_STORAGE_KEY = 'fileManager_filters';

interface UseFileManagerFiltersParams {
  files: FileItem[];
  showConfigsFolder: boolean;
  selectedProductId?: number;
}

/**
 * Хук для управления фильтрами и поиском файлов.
 * Отвечает за поиск, фильтрацию по категориям и сохранение фильтров в localStorage.
 */
export function useFileManagerFilters({
  files,
  showConfigsFolder,
  selectedProductId,
}: UseFileManagerFiltersParams) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Load filters from localStorage
  const loadFiltersFromStorage = useCallback(() => {
    try {
      const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        setCategoryFilter(filters.categoryFilter || 'all');
      }
    } catch (error) {
      // Silent fail
    }
  }, []);

  // Save filters to localStorage
  const saveFiltersToStorage = useCallback(() => {
    try {
      const filters = { categoryFilter };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      // Silent fail
    }
  }, [categoryFilter]);

  useEffect(() => {
    saveFiltersToStorage();
  }, [saveFiltersToStorage]);

  // Filtered files based on search and category
  const filteredFiles = useMemo(() => {
    if (!files || files.length === 0) {
      return [];
    }

    if (showConfigsFolder) {
      return files
        .filter((file) => {
          const searchMatch =
            searchTerm === '' ||
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (file.description &&
              file.description.toLowerCase().includes(searchTerm.toLowerCase()));
          const categoryMatch =
            categoryFilter === 'all' || file.category === categoryFilter;
          const pathMatch = file.path && file.path.includes('/configs/');
          return searchMatch && categoryMatch && pathMatch;
        })
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
    } else {
      const regularFiles = files
        .filter((file) => {
          const searchMatch =
            searchTerm === '' ||
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (file.description &&
              file.description.toLowerCase().includes(searchTerm.toLowerCase()));
          const categoryMatch =
            categoryFilter === 'all' || file.category === categoryFilter;
          const notInConfigs = !file.path || !file.path.includes('/configs/');
          return searchMatch && categoryMatch && notInConfigs;
        })
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });

      const configsFolderMatches =
        searchTerm === '' ||
        'configs'.toLowerCase().includes(searchTerm.toLowerCase()) ||
        'user settings'.toLowerCase().includes(searchTerm.toLowerCase());

      if (
        configsFolderMatches &&
        (categoryFilter === 'all' || categoryFilter === 'folder')
      ) {
        const configsFolder: FileItem = {
          id: 'configs_folder',
          name: 'configs',
          type: 'folder',
          category: 'folder',
          size: 0,
          modified: new Date().toISOString(),
          status: 'active',
          path: '/configs',
          description: 'Folder for user settings',
          productId: selectedProductId,
        };
        return [configsFolder, ...regularFiles];
      }

      return regularFiles;
    }
  }, [files, searchTerm, categoryFilter, showConfigsFolder, selectedProductId]);

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all';

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setCategoryFilter('all');
  }, []);

  return {
    searchTerm,
    categoryFilter,
    filteredFiles,
    hasActiveFilters,
    setSearchTerm,
    setCategoryFilter,
    resetFilters,
    loadFiltersFromStorage,
  };
}

