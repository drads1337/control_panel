import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Settings } from 'lucide-react'
import { useRemoteControlLogic } from './hooks/use-remote-control-logic'
import { RemoteControlHeader } from './components/remote-control-header'
import { RemoteControlErrorState } from './components/remote-control-error-state'
import { RemoteControlAccessDenied } from './components/remote-control-access-denied'
import RemoteControlStatsCards from './remote-control-stats-cards'
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
    canCreate,
    canEdit,
    canDelete,
    canToggle,
    canView
  } = useRemoteControlLogic()

  if (!canView) {
    return <RemoteControlAccessDenied />
  }

  if (error) {
    return <RemoteControlErrorState error={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
      <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
          Remote Control
        </h1>
        <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
          Manage remote control features for clients
        </p>
      </div>
      <Card>
        <RemoteControlHeader
          selectedProductId={selectedProductId}
          products={products}
          productsLoading={productsLoading}
          loading={loading}
          onProductChange={handleProductChange}
          onRefresh={loadData}
        />
        
        <CardContent className="p-3 xs:p-4 sm:pt-0 sm:pb-4">
          {!selectedProductId ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <Settings className="h-10 w-10 xs:h-12 xs:w-12 text-muted-foreground mx-auto mb-3 xs:mb-4" />
                <div className="text-sm xs:text-base text-muted-foreground">Please select a product to manage remote control features</div>
              </div>
            </div>
          ) : loading ? (
            <Spinner message="Loading remote control..." />
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
              getCategoryFeatures={getCategoryFeatures}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              canToggle={canToggle}
            />
          )}
        </CardContent>
      </Card>

      {selectedProductId && !loading && categories.length > 0 && (
        <div className="mt-3 xs:mt-4 sm:mt-5 md:mt-6">
          <RemoteControlStatsCards categories={categories} stats={stats} />
        </div>
      )}

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
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  )
}