import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  updateProductStatus,
  bulkUpdateProductStatus,
  deleteProduct,
  bulkDeleteProducts,
} from '@/entities/product';
import { useAuth } from '@/shared/hooks';
import { useMutationWithCache } from '@/shared/hooks';
import { toast } from 'sonner';
import { productKeys } from './product-keys';
import type { Product } from '@/entities/product';

export function useProductMutations() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const updateCachedProducts = (
    updater: (products: Product[]) => Product[]
  ) => {
    const previousProducts = queryClient.getQueryData<Product[]>(productKeys.list('all'));
    if (!previousProducts) return null;

    queryClient.setQueryData<Product[]>(productKeys.list('all'), updater(previousProducts));
    return previousProducts;
  };

  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ productId, status }: { productId: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateProductStatus(productId, status),
    invalidateQueries: [], // Не инвалидируем, чтобы не перезаписать optimistic update
    successMessage: 'Product status successfully updated!',
    errorMessage: 'Error updating status.',
    mutationOptions: {
      onMutate: async ({ productId, status }: { productId: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) => {
        await queryClient.cancelQueries({ queryKey: productKeys.list('all') });
        const previousProducts = updateCachedProducts((products) =>
          products.map((product) =>
            product.id === productId ? { ...product, status } : product
          )
        );

        return { previousProducts };
      },
      onSettled: (_data: void | undefined, error: unknown, _variables, context) => {
        const typedContext = context as { previousProducts?: Product[] | null } | undefined;
        if (error && typedContext?.previousProducts) {
          queryClient.setQueryData<Product[]>(productKeys.list('all'), typedContext.previousProducts);
        }
      },
    },
  });

  const bulkUpdateStatusMutation = useMutationWithCache({
    mutationFn: ({ productIds, status }: { productIds: number[]; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      bulkUpdateProductStatus(productIds, status),
    invalidateQueries: [], // Не инвалидируем, чтобы не перезаписать optimistic update
    onSuccess: (_, variables) => {
      toast.success(`Status of ${variables.productIds.length} products successfully updated!`);
      // Optimistic update уже обновил кеш, дополнительная инвалидация не нужна
    },
    errorMessage: 'Error performing bulk action.',
    mutationOptions: {
      onMutate: async ({ productIds, status }: { productIds: number[]; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) => {
        await queryClient.cancelQueries({ queryKey: productKeys.list('all') });
        const previousProducts = updateCachedProducts((products) =>
          products.map((product) =>
            productIds.includes(product.id) ? { ...product, status } : product
          )
        );

        return { previousProducts };
      },
      onSettled: (_data: void | undefined, error: unknown, _variables, context) => {
        const typedContext = context as { previousProducts?: Product[] | null } | undefined;
        if (error && typedContext?.previousProducts) {
          queryClient.setQueryData<Product[]>(productKeys.list('all'), typedContext.previousProducts);
        }
      },
    },
  });

  const deleteProductMutation = useMutationWithCache({
    mutationFn: (productId: number) => deleteProduct(productId),
    invalidateQueries: [productKeys.lists()],
    successMessage: 'Product successfully deleted!',
    errorMessage: 'Error deleting product.',
  });

  const bulkDeleteProductsMutation = useMutationWithCache({
    mutationFn: (productIds: number[]) => bulkDeleteProducts(productIds),
    invalidateQueries: [productKeys.lists()],
    onSuccess: (_, variables) => {
      toast.success(`Successfully deleted ${variables.length} products!`);
    },
    errorMessage: 'Error performing bulk action.',
  });

  const handleStatusChange = useCallback(
    (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated) return;
      updateStatusMutation.mutate({ productId, status: newStatus });
    },
    [isAuthenticated, updateStatusMutation]
  );

  const handleBulkStatusChange = useCallback(
    (productIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated || productIds.length === 0) return;
      bulkUpdateStatusMutation.mutate({ productIds, status });
    },
    [isAuthenticated, bulkUpdateStatusMutation]
  );

  const handleDeleteProduct = useCallback(
    async (productId: number) => {
      if (!isAuthenticated) return;

      if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
      }

      await deleteProductMutation.mutateAsync(productId);
    },
    [isAuthenticated, deleteProductMutation]
  );

  const handleBulkDelete = useCallback(
    async (productIds: number[]) => {
      if (!isAuthenticated || productIds.length === 0) return;
      await bulkDeleteProductsMutation.mutateAsync(productIds);
    },
    [isAuthenticated, bulkDeleteProductsMutation]
  );

  return {
    handleStatusChange,
    handleBulkStatusChange,
    handleDeleteProduct,
    handleBulkDelete,
    isUpdatingStatus: updateStatusMutation.isPending,
    isDeleting: deleteProductMutation.isPending,
    isBulkUpdating: bulkUpdateStatusMutation.isPending,
    isBulkDeleting: bulkDeleteProductsMutation.isPending,
  };
}

