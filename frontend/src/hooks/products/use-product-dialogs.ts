import { useState, useCallback } from 'react';
import type { Product } from '@/entities/product';

export function useProductDialogs() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const openCreateDialog = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const openEditDialog = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowEditDialog(true);
  }, []);

  const openUploadDialog = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowUploadDialog(true);
  }, []);

  const openNotificationsDialog = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowNotificationsDialog(true);
  }, []);

  const openPricesDialog = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowPricesDialog(true);
  }, []);

  const openChangelogDialog = useCallback((product: Product) => {
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
    // Dialog states
    showCreateDialog,
    showPricesDialog,
    showNotificationsDialog,
    showUploadDialog,
    showEditDialog,
    showChangelogDialog,
    selectedProduct,
    // Actions
    openCreateDialog,
    openEditDialog,
    openUploadDialog,
    openNotificationsDialog,
    openPricesDialog,
    openChangelogDialog,
    closeAllDialogs,
    // Setters (for backward compatibility)
    setShowCreateDialog,
    setShowPricesDialog,
    setShowNotificationsDialog,
    setShowUploadDialog,
    setShowEditDialog,
    setShowChangelogDialog,
    setSelectedProduct,
  };
}

