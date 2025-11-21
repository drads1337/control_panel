import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Product } from '@/entities/product';
import { ProductRow } from './ProductRow';

interface ProductsVirtualizedListProps {
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

export const ProductsVirtualizedList: React.FC<ProductsVirtualizedListProps> = ({
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
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: '600px', contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div className="divide-y">
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const product = products[virtualRow.index];
            return (
              <div
                key={product.id}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ProductRow
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

