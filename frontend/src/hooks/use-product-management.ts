import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getProducts,
  updateProductStatus,
  bulkUpdateProductStatus,
  deleteProduct,
  bulkDeleteProducts,
  type Product,
} from '@/entities/product';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useMutationWithCache } from './use-mutation-helpers';
import { toast } from 'sonner';

// Universal terminology query keys
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (type?: string) => [...productKeys.lists(), type || 'all'] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: number) => [...productKeys.details(), id] as const,
};

interface UseProductManagementReturn {
  products: Product[];
  loading: boolean;
  error: string | null;

  selectedProducts: number[];
  bulkAction: string;
  showCreateDialog: boolean;
  showPricesDialog: boolean;
  showNotificationsDialog: boolean;
  showUploadDialog: boolean;
  showEditDialog: boolean;
  showChangelogDialog: boolean;
  selectedProduct: Product | null;
  notification: { message: string; type: 'success' | 'error' } | null;

  fetchProducts: () => Promise<void>;
  toggleProductSelection: (productId: number) => void;
  handleBulkAction: () => Promise<void>;
  handleStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => Promise<void>;
  handleDeleteProduct: (productId: number) => Promise<void>;
  handleViewProduct: (product: Product) => void;
  handleEditProduct: (product: Product) => void;
  handleUploadProduct: (product: Product) => void;
  handleNotificationsProduct: (product: Product) => void;
  handlePricesProduct: (product: Product) => void;
  handleChangelogProduct: (product: Product) => void;
  closeAllDialogs: () => void;

  setBulkAction: (action: string) => void;
  setSelectedProducts: (products: number[]) => void;
  setShowCreateDialog: (open: boolean) => void;
  setShowPricesDialog: (open: boolean) => void;
  setShowNotificationsDialog: (open: boolean) => void;
  setShowUploadDialog: (open: boolean) => void;
  setShowEditDialog: (open: boolean) => void;
  setShowChangelogDialog: (open: boolean) => void;
  setSelectedProduct: (product: Product | null) => void;
  setNotification: (notification: { message: string; type: 'success' | 'error' } | null) => void;
}

export function useProductManagement(onViewProduct?: (product: Product) => void, onCreateProduct?: () => void): UseProductManagementReturn {
  const { isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();

  const canManageStatus = hasPermission('products.status');
  const canDeleteProducts = hasPermission('products.delete');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const {
    data: productsData,
    isLoading,
    error: productsError,
    refetch,
  } = useQuery({
    queryKey: productKeys.list('all'),
    queryFn: async () => {
      // Use new universal function
      const response = await getProducts('all');
      return response.products || [];
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const products = productsData || [];
  const loading = isLoading;
  const error = productsError
    ? (productsError as any)?.message || 'Failed to fetch products'
    : null;

  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  
  const toggleProductSelection = useCallback((productId: number) => {
    setSelectedProducts((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  }, []);

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
      toast.success(`Status of ${variables.productIds.length} products successfully updated!`)
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
      toast.success(`Successfully deleted ${variables.length} products!`)
    },
    errorMessage: 'Error performing bulk action.',
  });

  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedProducts.length === 0 || !isAuthenticated) return;

    try {
      if (bulkAction === 'delete') {
        await bulkDeleteProductsMutation.mutateAsync(selectedProducts);
      } else {
        const status = bulkAction as 'active' | 'inactive' | 'maintenance' | 'testing';
        await bulkUpdateStatusMutation.mutateAsync({ productIds: selectedProducts, status });
      }

      setSelectedProducts([]);
      setBulkAction('');
    } catch (err) {

    }
  }, [bulkAction, selectedProducts, isAuthenticated, bulkDeleteProductsMutation, bulkUpdateStatusMutation]);

  const handleStatusChange = useCallback(
    async (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => {
      if (!isAuthenticated) return;

      try {
        await updateStatusMutation.mutateAsync({ productId, status: newStatus });
      } catch (err) {

      }
    },
    [isAuthenticated, updateStatusMutation]
  );

  const handleDeleteProduct = useCallback(
    async (productId: number) => {
      if (!isAuthenticated) return;

      if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
      }

      try {
        await deleteProductMutation.mutateAsync(productId);
      } catch (err) {

      }
    },
    [isAuthenticated, deleteProductMutation]
  );

  const handleViewProduct = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      onViewProduct?.(product);
    },
    [onViewProduct]
  );

  const handleEditProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowEditDialog(true);
  }, []);

  const handleUploadProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowUploadDialog(true);
  }, []);

  const handleNotificationsProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowNotificationsDialog(true);
  }, []);

  const handlePricesProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowPricesDialog(true);
  }, []);

  const handleChangelogProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowChangelogDialog(true);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setShowEditDialog(false);
    setShowUploadDialog(false);
    setShowNotificationsDialog(false);
    setShowPricesDialog(false);
    setShowCreateDialog(false);
    setShowChangelogDialog(false);
    setSelectedProduct(null);
  }, []);

  return {
    products,
    loading,
    error,
    selectedProducts,
    bulkAction,
    showCreateDialog,
    showPricesDialog,
    showNotificationsDialog,
    showUploadDialog,
    showEditDialog,
    showChangelogDialog,
    selectedProduct,
    notification,
    fetchProducts: async () => {
      await refetch()
    },
    toggleProductSelection,
    handleBulkAction,
    handleStatusChange,
    handleDeleteProduct,
    handleViewProduct,
    handleEditProduct,
    handleUploadProduct,
    handleNotificationsProduct,
    handlePricesProduct,
    handleChangelogProduct,
    closeAllDialogs,
    setBulkAction,
    setSelectedProducts,
    setShowCreateDialog,
    setShowPricesDialog,
    setShowNotificationsDialog,
    setShowUploadDialog,
    setShowEditDialog,
    setShowChangelogDialog,
    setSelectedProduct,
    setNotification,
  };
}
