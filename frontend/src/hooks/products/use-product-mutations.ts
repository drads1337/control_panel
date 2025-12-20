import { useCallback } from 'react';
import {
  updateProductStatus,
  bulkUpdateProductStatus,
  deleteProduct,
  bulkDeleteProducts,
} from '@/entities/product';
import { useAuth } from '@/hooks/use-auth';
import { useMutationWithCache } from '../use-mutation-helpers';
import { toast } from 'sonner';
import { productKeys } from './product-keys';

export function useProductMutations() {
  const { isAuthenticated } = useAuth();

  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ productId, status }: { productId: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateProductStatus(productId, status),
    invalidateQueries: [productKeys.lists()],
    successMessage: 'Product status successfully updated!',
    errorMessage: 'Error updating status.',
  });

  const bulkUpdateStatusMutation = useMutationWithCache({
    mutationFn: ({ productIds, status }: { productIds: number[]; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      bulkUpdateProductStatus(productIds, status),
    invalidateQueries: [productKeys.lists()],
    onSuccess: (_, variables) => {
      toast.success(`Status of ${variables.productIds.length} products successfully updated!`);
    },
    errorMessage: 'Error performing bulk action.',
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
    async (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated) return;
      await updateStatusMutation.mutateAsync({ productId, status: newStatus });
    },
    [isAuthenticated, updateStatusMutation]
  );

  const handleBulkStatusChange = useCallback(
    async (productIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated || productIds.length === 0) return;
      await bulkUpdateStatusMutation.mutateAsync({ productIds, status });
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

