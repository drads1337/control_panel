import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useKeysQuery, keyKeys } from '@/hooks/use-keys-query';
import { getProducts } from '@/entities/product';

interface UseKeysDataParams {
  viewMode: 'my' | 'all';
  filters: {
    status: string;
    productId: string;
    search: string;
  };
  currentPage: number;
  canViewKeys: boolean;
}

interface UseKeysDataReturn {

  keys: any[];
  loading: boolean;
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };

  loadProducts: () => Promise<void>;
  invalidateQueries: () => void;
}

export function useKeysData({
  viewMode,
  filters,
  currentPage,
  canViewKeys,
}: UseKeysDataParams): UseKeysDataReturn {
  const queryClient = useQueryClient();

  const showMyKeysOnly = !canViewKeys ? true : viewMode === 'my';
  const keysQuery = useKeysQuery({
    page: currentPage,
    per_page: 20,
    status: filters.status !== 'all' ? filters.status : undefined,
    product_id: filters.productId !== 'all' ? parseInt(filters.productId) : undefined,
    search: filters.search || undefined,
    my_keys: showMyKeysOnly,
  });

  const keys = keysQuery.keys || [];
  const loading = keysQuery.loading;
  const pagination = {
    page: keysQuery.currentPage,
    perPage: keysQuery.perPage,
    total: keysQuery.total,
    pages: keysQuery.pages,
  };

  const loadProducts = useCallback(async (): Promise<void> => {
    try {
      await getProducts('all');

    } catch (error) {

      throw error;
    }
  }, []);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keyKeys.lists() });
    queryClient.invalidateQueries({ queryKey: keyKeys.stats() });
  }, [queryClient]);

  return {

    keys,
    loading,
    products: [],
    pagination,

    loadProducts,
    invalidateQueries,
  };
}
