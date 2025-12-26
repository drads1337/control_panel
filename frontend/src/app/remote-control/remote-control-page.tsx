import React from 'react'
import { useRemoteControlLogic } from './hooks/use-remote-control-logic'
import { RemoteControlHeader } from './components/remote-control-header'
import { RemoteControlStats } from './components/remote-control-stats'
import { RemoteControlCategories } from './components/remote-control-categories'
import { RemoteControlFeatures } from './components/remote-control-features'
import { CreateCategoryDialog } from './components/create-category-dialog'
import { CreateFeatureDialog } from './components/create-feature-dialog'
import { EditFeatureDialog } from './components/edit-feature-dialog'
import { RemoteControlErrorState } from './components/remote-control-error-state'
import { RemoteControlAccessDenied } from './components/remote-control-access-denied'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Remote Control Page
 * Main page component for remote control operations
 */
function RemoteControlPage() {
  const {
    selectedProductId,
    products,
    productsLoading,
    activeTab,
    setActiveTab,
    features,
    categories,
    stats,
    loading,
    error,
    addDialogOpen,
    setAddDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingFeature,
    editingCategory,
    setEditingCategory,
    formData,
    setFormData,
    categoryFormData,
    setCategoryFormData,
    handleProductChange,
    handleFeatureToggle,
    handleAddFeature,
    handleEditFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    handleAddCategory,
    handleEditCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    resetForm,
    resetCategoryForm,
    getCategoryFeatures,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canToggle,
  } = useRemoteControlLogic()

  if (!canView) {
    return <RemoteControlAccessDenied />
  }

  if (productsLoading) {
    return (
      <div className="w-full p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error && !selectedProductId) {
    return <RemoteControlErrorState error={error} />
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <RemoteControlHeader
              products={products}
              selectedProductId={selectedProductId}
              onProductChange={handleProductChange}
              onAddCategory={() => setCategoryDialogOpen(true)}
              canCreate={canCreate}
            />
          </div>

          {selectedProductId && (
            <>
              <div className="px-4 lg:px-6">
                <RemoteControlStats stats={stats} loading={loading} />
              </div>

              <div className="px-4 lg:px-6">
                <RemoteControlCategories
                  categories={categories}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  loading={loading}
                />
              </div>

              <div className="px-4 lg:px-6">
                <RemoteControlFeatures
                  categories={categories}
                  features={features}
                  activeTab={activeTab}
                  getCategoryFeatures={getCategoryFeatures}
                  onToggleFeature={handleFeatureToggle}
                  onAddFeature={() => {
                    resetForm()
                    setAddDialogOpen(true)
                  }}
                  onEditFeature={handleEditFeature}
                  onDeleteFeature={handleDeleteFeature}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canToggle={canToggle}
                  loading={loading}
                />
              </div>
            </>
          )}

          {!selectedProductId && products.length === 0 && (
            <div className="px-4 lg:px-6">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <h2 className="text-lg font-semibold mb-2">No Products Available</h2>
                  <p className="text-sm text-muted-foreground">
                    Please create a product first to use remote control features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categoryFormData={categoryFormData}
        setCategoryFormData={setCategoryFormData}
        onSubmit={handleAddCategory}
        onUpdate={handleUpdateCategory}
        editingCategory={editingCategory}
        onClose={() => {
          setCategoryDialogOpen(false)
          setEditingCategory(null)
          resetCategoryForm()
        }}
      />

      <CreateFeatureDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        onSubmit={handleAddFeature}
        onClose={() => {
          setAddDialogOpen(false)
          resetForm()
        }}
      />

      {editingFeature && (
        <EditFeatureDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          feature={editingFeature}
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          onSubmit={handleUpdateFeature}
          onClose={() => {
            setEditDialogOpen(false)
            resetForm()
          }}
        />
      )}
    </div>
  )
}

export default RemoteControlPage
