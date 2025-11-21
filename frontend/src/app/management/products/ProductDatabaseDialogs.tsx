import React from 'react'
import { Button } from '@/components/ui/button'
import EditProductDialog from './EditProductDialog'
import CreateProductDialog from './CreateProductDialog'
import ProductFileUploadDialog from './ProductFileUploadDialog'
import NotificationsDialog from '../notifications/NotificationsDialog'
import ChangelogManagementDialog from '../changelog/ChangelogManagementDialog'
import PriceManager from '../PriceManager'
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
  closeAllDialogs,
  onSuccess,
  onUploadComplete,
}: ProductDatabaseDialogsProps) {
  return (
    <>
      {}
      {canManagePrices && (
        <PriceManager 
          open={showPricesDialog && !!selectedProduct} 
          onOpenChange={setShowPricesDialog}
          productId={selectedProduct?.id} 
        />
      )}

      {}
      <NotificationsDialog
        key="notifications-dialog"
        open={showNotificationsDialog && canManageNotifications}
        onOpenChange={(open) => {
          if (canManageNotifications) {
            setShowNotificationsDialog(open)
          }
        }}
        product={canManageNotifications ? selectedProduct : null}
      />

      {}
      {canUploadFiles && (
        <ProductFileUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          product={selectedProduct}
          onUploadComplete={onUploadComplete}
        />
      )}

      {}
      {canEditProducts && (
        <EditProductDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          product={selectedProduct}
          onSuccess={onSuccess}
        />
      )}

      {}
      {canCreateProducts && (
        <CreateProductDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onSuccess}
        />
      )}

      {}
      <ChangelogManagementDialog
        key="changelog-dialog"
        open={showChangelogDialog && canManageChangelog}
        onOpenChange={(open) => {
          if (canManageChangelog) {
            setShowChangelogDialog(open)
          }
        }}
        product={canManageChangelog ? selectedProduct : null}
      />
    </>
  )
}
