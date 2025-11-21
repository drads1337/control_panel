import { useState, useCallback } from 'react';
import { useKeysData } from './use-keys-data';
import { useKeysUI } from './use-keys-ui';
import { getProducts } from '@/entities/product';
import type { LicenseKey } from '@/entities/key';

interface UseKeysManagementParams {
  viewMode: 'my' | 'all';
  filters: {
    status: string;
    productId: string;
    search: string;
  };
  currentPage: number;
  canViewKeys: boolean;
}

interface UseKeysManagementReturn {

  keys: LicenseKey[];
  loading: boolean;
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };

  showKey: Record<number, boolean>;
  fullKeys: Record<number, string>;
  selectedKeys: Set<number>;
  actionLoading: Set<number>;
  selectedKey: LicenseKey | null;
  detailsDialogOpen: boolean;
  editDialogOpen: boolean;
  extendDialogOpen: boolean;

  handleToggleKeyVisibility: (keyId: number) => void;
  handleSelectKey: (keyId: number, selected: boolean) => void;
  handleSelectAll: (selected: boolean) => void;
  handleKeyAction: (action: string, keyId: number) => Promise<void>;
  handleViewDetails: (key: LicenseKey) => void;
  handleKeyCreated: (createdKeyId?: number) => Promise<void>;
  handleDialogSuccess: () => Promise<void>;
  loadProducts: () => Promise<void>;
  setDetailsDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setExtendDialogOpen: (open: boolean) => void;
  setSelectedKey: (key: LicenseKey | null) => void;
}

export function useKeysManagement({
  viewMode,
  filters,
  currentPage,
  canViewKeys,
}: UseKeysManagementParams): UseKeysManagementReturn {
  const [products, setProducts] = useState<Array<{ id: number; name: string; is_multi_app: boolean }>>([]);

  const keysData = useKeysData({
    viewMode,
    filters,
    currentPage,
    canViewKeys,
  });

  const loadProducts = useCallback(async () => {
    try {
      const response = await getProducts('all');
      setProducts(
        response.products.map((product) => ({
          id: product.id,
          name: product.name,
          is_multi_app: product.is_multi_app,
        }))
      );
    } catch (error) {

    }
  }, []);

  const keysUI = useKeysUI({
    keys: keysData.keys as LicenseKey[],
    loadProducts,
    invalidateQueries: keysData.invalidateQueries,
  });

  return {

    keys: keysData.keys as LicenseKey[],
    loading: keysData.loading,
    products,
    pagination: keysData.pagination,

    ...keysUI,

    loadProducts,
  };
}
