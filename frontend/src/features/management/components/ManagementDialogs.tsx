import React, { Suspense } from 'react'
import { useProductDialogStore } from '@/shared/model/use-product-dialog-store'

const ViewProductDialog = React.lazy(() =>
  import('@/features/product-management').then((module) => ({ default: module.ViewProductDialog }))
)

export function ManagementDialogs() {
  const {
    viewProductDialogOpen,
    selectedProduct,
    setViewProductDialogOpen,
    openEditProductDialog,
    openUploadProductDialog,
  } = useProductDialogStore()

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

