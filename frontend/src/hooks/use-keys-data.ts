import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useKeysQuery, keyKeys } from '@/entities/key';
import { getProducts } from '@/entities/product';
import { productKeys } from '@/hooks/products/product-keys';

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

  // Используем TanStack Query для продуктов с кешированием
  const { data: productsData, refetch: refetchProducts } = useQuery({
    queryKey: productKeys.list('all'),
    queryFn: async () => {
      const response = await getProducts('all');
      return response.products || [];
    },
    enabled: false, // Загружаем только по требованию
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут
  });

  const products = productsData?.map((product) => ({
    id: product.id,
    name: product.name,
    is_multi_app: product.is_multi_app,
  })) || [];

  const loadProducts = useCallback(async (): Promise<void> => {
    await refetchProducts();
  }, [refetchProducts]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keyKeys.lists() });
    queryClient.invalidateQueries({ queryKey: keyKeys.stats() });
  }, [queryClient]);

  return {
    keys,
    loading,
    products,
    pagination,
    loadProducts,
    invalidateQueries,
  };
}
