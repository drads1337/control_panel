import React from 'react'
import EditProductDialog from '../EditProductDialog'
import CreateProductDialog from '../CreateProductDialog'
import ProductFileUploadDialog from '../ProductFileUploadDialog'
import ViewProductDialog from '../ViewProductDialog'
import PriceManager from '../PriceManager'
import { NotificationsDialog } from '@/features/notifications'
import { ChangelogManagementDialog } from '@/features/changelog'
import { useProductDialogStore } from '@/shared/model/use-product-dialog-store'
import type { Product } from '@/entities/product'

interface ProductDatabaseDialogsProps {
  showCreateDialog: boolean
  showEditDialog: boolean
  showUploadDialog: boolean
  showPricesDialog: boolean
  showNotificationsDialog: boolean
  showChangelogDialog: boolean

  selectedProduct: Product | null

  canEditProducts: boolean
  canCreateProducts: boolean
  canUploadFiles: boolean
  canManagePrices: boolean
  canManageNotifications: boolean
  canManageChangelog: boolean

  setShowCreateDialog: (open: boolean) => void
  setShowEditDialog: (open: boolean) => void
  setShowUploadDialog: (open: boolean) => void
  setShowPricesDialog: (open: boolean) => void
  setShowNotificationsDialog: (open: boolean) => void
  setShowChangelogDialog: (open: boolean) => void
  setSelectedProduct: (product: Product | null) => void
  closeAllDialogs: () => void
  onSuccess: () => void
  onUploadComplete: () => void
}

export function ProductDatabaseDialogs({
  showCreateDialog,
  showEditDialog,
  showUploadDialog,
  showPricesDialog,
  showNotificationsDialog,
  showChangelogDialog,
  selectedProduct,
  canEditProducts,
  canCreateProducts,
  canUploadFiles,
  canManagePrices,
  canManageNotifications,
  canManageChangelog,
  setShowCreateDialog,
  setShowEditDialog,
  setShowUploadDialog,
  setShowPricesDialog,
  setShowNotificationsDialog,
  setShowChangelogDialog,
  setSelectedProduct,
  closeAllDialogs,
  onSuccess,
  onUploadComplete,
}: ProductDatabaseDialogsProps) {
  const { viewProductDialogOpen, selectedProduct: viewProduct, setViewProductDialogOpen } = useProductDialogStore();

  return (
    <>
      <ViewProductDialog
        open={viewProductDialogOpen}
        onOpenChange={setViewProductDialogOpen}
        product={viewProduct}
        onEdit={viewProduct ? (product) => {
          setViewProductDialogOpen(false);
          setSelectedProduct(product);
          setShowEditDialog(true);
        } : undefined}
        onUpload={viewProduct ? (product) => {
          setViewProductDialogOpen(false);
          setSelectedProduct(product);
          setShowUploadDialog(true);
        } : undefined}
        onPrices={viewProduct ? (product) => {
          setViewProductDialogOpen(false);
          setSelectedProduct(product);
          setShowPricesDialog(true);
        } : undefined}
        onNotifications={viewProduct ? (product) => {
          setViewProductDialogOpen(false);
          setSelectedProduct(product);
          setShowNotificationsDialog(true);
        } : undefined}
        onChangelog={viewProduct ? (product) => {
          setViewProductDialogOpen(false);
          setSelectedProduct(product);
          setShowChangelogDialog(true);
        } : undefined}
        canUploadFiles={canUploadFiles}
        canManagePrices={canManagePrices}
        canManageNotifications={canManageNotifications}
        canManageChangelog={canManageChangelog}
      />

      {canManagePrices && (
        <PriceManager 
          open={showPricesDialog && !!selectedProduct} 
          onOpenChange={setShowPricesDialog}
          productId={selectedProduct?.id} 
        />
      )}

      {canUploadFiles && (
        <ProductFileUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          product={selectedProduct}
          onSuccess={onUploadComplete}
        />
      )}

      {canEditProducts && (
        <EditProductDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          product={selectedProduct}
          onSuccess={onSuccess}
        />
      )}

      {canCreateProducts && (
        <CreateProductDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onSuccess}
        />
      )}

      {canManageNotifications && (
        <NotificationsDialog
          open={showNotificationsDialog}
          onOpenChange={setShowNotificationsDialog}
          product={selectedProduct}
          isAgent={false}
        />
      )}

      {canManageChangelog && (
        <ChangelogManagementDialog
          open={showChangelogDialog}
          onOpenChange={setShowChangelogDialog}
          product={selectedProduct}
          isAgent={false}
        />
      )}
    </>
  )
}

