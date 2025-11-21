import React, { Suspense } from 'react'
import { useManagementStore } from '@/stores/management-store'
import { useProductDialogs } from '@/hooks/products'

const ViewProductDialog = React.lazy(() =>
  import('./products').then((module) => ({ default: module.ViewProductDialog }))
)

export function ManagementDialogs() {
  const {
    dialogs,
    setViewProductDialogOpen,
    openEditProductDialog,
    openUploadProductDialog,
  } = useManagementStore()

  const { viewProductDialogOpen, selectedProduct } = dialogs

  const handleEdit = (product: typeof selectedProduct) => {
    if (product) {
      openEditProductDialog(product);
      setViewProductDialogOpen(false);
    }
  };

  const handleUpload = (product: typeof selectedProduct) => {
    if (product) {
      openUploadProductDialog(product);
      setViewProductDialogOpen(false);
    }
  };

  return (
    <Suspense fallback={null}>
      <ViewProductDialog
        open={viewProductDialogOpen}
        onOpenChange={setViewProductDialogOpen}
        product={selectedProduct}
        onEdit={handleEdit}
        onUpload={handleUpload}
      />
    </Suspense>
  )
}
