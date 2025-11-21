import { useMemo, useState, useCallback } from 'react';
import type { Product } from '@/entities/product';

export interface ProductFilters {
  searchTerm: string;
  status: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing';
  sortBy: 'name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}

const defaultFilters: ProductFilters = {
  searchTerm: '',
  status: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
};

export function useProductFilters(products: Product[]) {
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);

  const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower) ||
          product.id.toString().includes(searchLower)
      );
    }

    if (filters.status !== 'all') {
      result = result.filter((product) => product.status === filters.status);
    }

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
  }, [products, filters]);

  return {
    filters,
    filteredProducts,
    updateFilters,
    resetFilters,
  };
}
