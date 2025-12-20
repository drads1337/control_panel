import { useQuery } from '@tanstack/react-query';
import { createQueryRetry } from '@/lib/query-retry-utils';
import { getErrorMessage } from '@/lib/api/api-error-types';
import { getProducts, type Product } from '@/entities/product';
import { useAuth } from '@/lib/hooks';
import { productKeys } from './product-keys';

export function useProductQuery() {
  const { isAuthenticated } = useAuth();

  const {
    data: productsData,
    isLoading,
    error: productsError,
    refetch,
  } = useQuery({
    queryKey: productKeys.list('all'),
    queryFn: async () => {
      const response = await getProducts('all');
      return response.products || [];
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: createQueryRetry({ maxRetries: 2 }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const products: Product[] = productsData || [];
  const loading = isLoading;
  const error = productsError
    ? getErrorMessage(productsError) || 'Failed to fetch products'
    : null;

  return {
    products,
    loading,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}

