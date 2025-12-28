import React from 'react';
import type { Product } from '@/entities/product';
import { ProductRow } from './ProductRow';

interface ProductsListProps {
  products: Product[];
  selectedProducts: number[];
  onToggleProductSelection: (productId: number) => void;
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onUploadProduct: (product: Product) => void;
  onNotificationsProduct: (product: Product) => void;
  onPricesProduct: (product: Product) => void;
  onChangelogProduct: (product: Product) => void;
  onStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;
  onDeleteProduct: (productId: number) => void;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

export const ProductsList: React.FC<ProductsListProps> = ({
  products,
  selectedProducts,
  onToggleProductSelection,
  onViewProduct,
  onEditProduct,
  onUploadProduct,
  onNotificationsProduct,
  onPricesProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteProduct,
  canEditProducts,
  canDeleteProducts,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  return (
    <div className="divide-y">
      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          isSelected={selectedProducts.includes(product.id)}
          onToggleSelection={onToggleProductSelection}
          onViewProduct={onViewProduct}
          onEditProduct={onEditProduct}
          onUploadProduct={onUploadProduct}
          onNotificationsProduct={onNotificationsProduct}
          onPricesProduct={onPricesProduct}
          onChangelogProduct={onChangelogProduct}
          onStatusChange={onStatusChange}
          onDeleteProduct={onDeleteProduct}
          canEditProducts={canEditProducts}
          canDeleteProducts={canDeleteProducts}
          canUploadFiles={canUploadFiles}
          canManageNotifications={canManageNotifications}
          canManagePrices={canManagePrices}
          canManageChangelog={canManageChangelog}
          canManageStatus={canManageStatus}
        />
      ))}
    </div>
  );
};

