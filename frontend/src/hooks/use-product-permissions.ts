import { useMemo, useEffect, useState } from 'react';
import { usePermissions } from './use-permissions';
import { getProducts } from '@/entities/product';

export function useProductPermissions() {
  const { hasPermission } = usePermissions();
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const hasGlobalProductsView = hasPermission('products.view');
  const hasKeysPermission = hasPermission('keys.view') || hasPermission('keys.create');

  useEffect(() => {
    const loadProductsCount = async () => {

      if (hasGlobalProductsView) {
        setProductsCount(1);
        return;
      }

      if (hasKeysPermission) {
        try {
          const response = await getProducts('all');
          if (response.success && response.products) {
            setProductsCount(response.products.length);
          } else {
            setProductsCount(0);
          }
        } catch (error) {

          setProductsCount(0);
        }
      } else {
        setProductsCount(0);
      }
    };

    loadProductsCount();
  }, [hasGlobalProductsView, hasKeysPermission]);

  const effectiveCanViewProducts = useMemo(() => {
    if (hasGlobalProductsView) return true;
    if (hasKeysPermission && productsCount !== null && productsCount > 0) return true;
    return false;
  }, [hasGlobalProductsView, hasKeysPermission, productsCount]);

  const permissions = useMemo(
    () => ({
      canViewProducts: effectiveCanViewProducts,
      canCreateProducts: hasPermission('products.create'),
      canEditProducts: hasPermission('products.edit'),
      canDeleteProducts: hasPermission('products.delete'),
      canUploadFiles: hasPermission('products.upload_files'),
      canManagePrices: hasPermission('products.manage_prices'),
      canManageChangelog: hasPermission('products.changelog_view'),
      canManageNotifications: hasPermission('products.notifications_view'),
      canManageStatus: hasPermission('products.status'),
    }),
    [effectiveCanViewProducts, hasPermission]
  );

  return permissions;
}
