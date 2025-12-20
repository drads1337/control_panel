import { useState, useCallback } from 'react';
import type { Product } from '@/entities/product';

export function useProductSelection(products: Product[]) {
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const toggleProductSelection = useCallback((productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const selectAll = useCallback((filteredProducts?: Product[]) => {
    const productsToSelect = filteredProducts || products;
    const allSelected = productsToSelect.every(p => selectedProducts.includes(p.id));
    
    if (allSelected && productsToSelect.length > 0) {
      // Deselect filtered products
      const filteredIds = productsToSelect.map(p => p.id);
      setSelectedProducts(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered products (keep existing selections)
      const filteredIds = productsToSelect.map(p => p.id);
      setSelectedProducts(prev => {
        const newSelection = [...prev];
        filteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  }, [products, selectedProducts]);

  const clearSelection = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  const isAllSelected = (filteredProducts?: Product[]) => {
    const productsToCheck = filteredProducts || products;
    return productsToCheck.length > 0 && productsToCheck.every(p => selectedProducts.includes(p.id));
  };

  return {
    selectedProducts,
    setSelectedProducts,
    toggleProductSelection,
    selectAll,
    clearSelection,
    isAllSelected,
  };
}

