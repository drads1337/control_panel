import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useRemoteControlLogic } from './hooks/use-remote-control-logic'
import { RemoteControlHeader, RemoteControlErrorState, RemoteControlAccessDenied } from './components'
import RemoteControlTabs from './remote-control-tabs'
import CategoryDialog from './category-dialog'

export default function RemoteControl() {
  const {
    selectedProductId,
    products,
    productsLoading,
    activeTab,
    setActiveTab,
    features,
    categories,
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
    loadData,
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
    canView
  } = useRemoteControlLogic()

  if (!canView) {
    return <RemoteControlAccessDenied />
  }

  if (error) {
    return <RemoteControlErrorState error={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-4 px-2 xs:px-3 sm:px-4 md:px-0">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
              Remote Control
            </h1>
            <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Feature configuration
            </p>
          </div>
        </div>
      </div>

      {/* Product Selector */}
      <div className="mb-4">
        <RemoteControlHeader
          selectedProductId={selectedProductId}
          products={products}
          productsLoading={productsLoading}
          loading={loading}
          onProductChange={handleProductChange}
          onRefresh={loadData}
        />
      </div>

      {/* Main Content */}
      {!selectedProductId ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground/50 border-2 border-dashed border-muted rounded-lg">
          <span className="text-xs">Select a product to begin</span>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center h-[200px]">
          <Spinner size="sm" />
        </div>
      ) : (
        <RemoteControlTabs
          categories={categories}
          features={features}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          loading={loading}
          addDialogOpen={addDialogOpen}
          setAddDialogOpen={setAddDialogOpen}
          editDialogOpen={editDialogOpen}
          setEditDialogOpen={setEditDialogOpen}
          editingFeature={editingFeature}
          formData={formData}
          setFormData={setFormData}
          onAddCategory={() => {
            setEditingCategory(null)
            resetCategoryForm()
            setCategoryDialogOpen(true)
          }}
          onManageCategories={() => setCategoryDialogOpen(true)}
          onFeatureToggle={handleFeatureToggle}
          onEditFeature={handleEditFeature}
          onDeleteFeature={handleDeleteFeature}
          onAddFeature={handleAddFeature}
          onUpdateFeature={handleUpdateFeature}
          onResetForm={resetForm}
          getCategoryFeatures={getCategoryFeatures}
        />
      )}

      {/* Dialogs */}
      {selectedProductId && (
        <CategoryDialog
          categoryDialogOpen={categoryDialogOpen}
          setCategoryDialogOpen={setCategoryDialogOpen}
          editingCategory={editingCategory}
          categories={categories}
          categoryFormData={categoryFormData}
          setCategoryFormData={setCategoryFormData}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          onResetCategoryForm={resetCategoryForm}
        />
      )}
    </div>
  )
}