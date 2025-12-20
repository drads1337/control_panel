import { useQuery } from '@tanstack/react-query'
import { createQueryRetry } from '@/lib/query-retry-utils'
import { getErrorMessage } from '@/lib/api/api-error-types'
import { getProducts, getAvailableProductsForAssignment } from '@/entities/product'
import type { Product } from '@/entities/product'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (type?: string) => [...productKeys.lists(), type] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: number) => [...productKeys.details(), id] as const,
  availableForAssignment: () => [...productKeys.all, 'available-for-assignment'] as const,
}

interface UseProductsQueryReturn {
  products: Product[]
  loading: boolean
  error: string | null
  refetch: () => void
}

interface UseProductsAvailableForAssignmentReturn {
  products: Product[]
  totalCount: number
  page: number
  perPage: number
  totalPages: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProductsQuery(type: string = 'all'): UseProductsQueryReturn {
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: productKeys.list(type),
    queryFn: async () => {
      const response = await getProducts(type)
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: createQueryRetry({ maxRetries: 2, maxRetriesRateLimit: 0, retryPaymentErrors: false }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const errorMessage = error
    ? getErrorMessage(error) || 'Failed to load products'
    : null

  return {
    products: productsData?.products || [],
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

export function useProductsAvailableForAssignment(
  page: number = 1,
  perPage: number = 50
): UseProductsAvailableForAssignmentReturn {
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...productKeys.availableForAssignment(), page, perPage],
    queryFn: async () => {
      const response = await getAvailableProductsForAssignment(page, perPage)
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      if (error?.response?.status === 402) {
        return false
      }
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const errorMessage = error
    ? (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Failed to load available products'
    : null

  return {
    products: productsData?.products || [],
    totalCount: productsData?.total_count || 0,
    page: productsData?.page || page,
    perPage: productsData?.per_page || perPage,
    totalPages: productsData?.total_pages || 0,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}
