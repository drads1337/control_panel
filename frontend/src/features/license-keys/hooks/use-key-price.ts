import { useQuery } from '@tanstack/react-query';
import { enhancedApi } from '@/lib/api/enhanced-client';

interface ProductPrices {
  [period: string]: number;
}

interface UseKeyPriceParams {
  productId: number | null;
  durationHours: number;
  enabled?: boolean;
}

interface UseKeyPriceReturn {
  price: number | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to calculate key price based on product pricing
 */
export function useKeyPrice({ productId, durationHours, enabled = true }: UseKeyPriceParams): UseKeyPriceReturn {
  const {
    data: pricesData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['product-prices', productId],
    queryFn: async () => {
      if (!productId) return null;
      const response = await enhancedApi.get(`/api/products/${productId}/prices`);
      return response.data as { success: boolean; prices: ProductPrices };
    },
    enabled: enabled && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const calculatePrice = (): number | null => {
    if (!pricesData?.prices || !productId) return null;

    const prices = pricesData.prices;
    
    // Try exact match first
    const periodStr = String(Math.floor(durationHours));
    if (prices[periodStr] !== undefined) {
      return prices[periodStr];
    }

    // Calculate based on 1 hour price
    if (prices['1'] !== undefined) {
      return prices['1'] * durationHours;
    }

    // Try to find any price and calculate per hour
    const periods = Object.keys(prices).filter(p => !p.startsWith('custom_'));
    if (periods.length > 0) {
      const firstPeriod = periods[0];
      const periodHours = parseFloat(firstPeriod);
      if (!isNaN(periodHours) && periodHours > 0) {
        const pricePerHour = prices[firstPeriod] / periodHours;
        return pricePerHour * durationHours;
      }
    }

    return null;
  };

  return {
    price: calculatePrice(),
    loading: isLoading,
    error: error as Error | null
  };
}



