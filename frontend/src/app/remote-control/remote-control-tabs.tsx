import React from 'react'
import { Tabs, TabsContent, TabsContents } from '@/components/animate-ui/components/radix/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import CategoryTabs from './category-tabs'
import FeatureList from './feature-list'
import FeatureDialogs from './feature-dialogs'
import { RemoteCategory, RemoteFeature } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface RemoteControlTabsProps {
  categories: RemoteCategory[]
  features: RemoteFeature[]
  activeTab: string
  setActiveTab: (tab: string) => void
  loading: boolean
  addDialogOpen: boolean
  setAddDialogOpen: (open: boolean) => void
  editDialogOpen: boolean
  setEditDialogOpen: (open: boolean) => void
  editingFeature: RemoteFeature | null
  formData: {
    name: string
    description: string
    category_id: string
    enabled: boolean
  }
  setFormData: (data: RemoteControlTabsProps['formData'] | ((prev: RemoteControlTabsProps['formData']) => RemoteControlTabsProps['formData'])) => void
  onAddCategory: () => void
  onManageCategories: () => void
  onFeatureToggle: (featureId: string) => void
  onEditFeature: (feature: RemoteFeature) => void
  onDeleteFeature: (featureId: string) => void
  onAddFeature: () => void
  onUpdateFeature: () => void
  onResetForm: () => void
  getCategoryFeatures: (categoryId: string) => RemoteFeature[]
}

export default function RemoteControlTabs({
  categories,
  features,
  activeTab,
  setActiveTab,
  loading,
  addDialogOpen,
  setAddDialogOpen,
  editDialogOpen,
  setEditDialogOpen,
  editingFeature,
  formData,
  setFormData,
  onAddCategory,
  onManageCategories,
  onFeatureToggle,
  onEditFeature,
  onDeleteFeature,
  onAddFeature,
  onUpdateFeature,
  onResetForm,
  getCategoryFeatures
}: RemoteControlTabsProps) {

  // Helper to open Add Dialog with pre-filled category
  const handleOpenAddDialog = (categoryId: string) => {
    setFormData((prev) => ({ ...prev, category_id: categoryId }))
    setAddDialogOpen(true)
  }

  if (categories.length === 0) {
    return (
      <>
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddCategory={onAddCategory}
          onManageCategories={onManageCategories}
        />
        <FeatureDialogs
          categories={categories}
          currentCategoryId={activeTab}
          addDialogOpen={addDialogOpen}
          setAddDialogOpen={setAddDialogOpen}
          editDialogOpen={editDialogOpen}
          setEditDialogOpen={setEditDialogOpen}
          editingFeature={editingFeature}
          formData={formData}
          setFormData={setFormData}
          onAddFeature={onAddFeature}
          onUpdateFeature={onUpdateFeature}
          onEditFeature={onEditFeature}
          onResetForm={onResetForm}
        />
      </>
    )
  }

  // Render category content
  const renderCategoryContent = (category: RemoteCategory) => (
    <div className="space-y-4">
      {/* Compact Header for Content */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b">
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold leading-none">
              {category.name ? category.name : <span className="text-muted-foreground italic">Unnamed</span>}
            </h3>
            {category.description && (
              <span className="text-[10px] text-muted-foreground truncate hidden sm:inline-block">
                — {category.description}
              </span>
            )}
          </div>
          {/* Mobile only description */}
          {category.description && (
            <span className="text-[10px] text-muted-foreground truncate sm:hidden mt-0.5">
              {category.description}
            </span>
          )}
        </div>

        <ConditionalRender permission="remote_control.create" fallback={null}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenAddDialog(category.id)}
            className="h-6 px-2 text-xs hover:bg-muted"
            title="Add Feature to this category"
          >
            <Plus className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Feature</span>
          </Button>
        </ConditionalRender>
      </div>
      
      <FeatureList
        features={getCategoryFeatures(category.id)}
        loading={loading}
        onFeatureToggle={onFeatureToggle}
        onEditFeature={onEditFeature}
        onDeleteFeature={onDeleteFeature}
        onAddFeature={() => handleOpenAddDialog(category.id)}
      />
    </div>
  )

  // If only one category, show content without tabs
  if (categories.length === 1) {
    const category = categories[0]
    return (
      <>
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddCategory={onAddCategory}
          onManageCategories={onManageCategories}
        />
        <Card className="border-border bg-card mt-2">
          <CardContent className="p-4 sm:p-6 min-h-[400px]">
            {renderCategoryContent(category)}
          </CardContent>
        </Card>
        <FeatureDialogs
          categories={categories}
          currentCategoryId={activeTab}
          addDialogOpen={addDialogOpen}
          setAddDialogOpen={setAddDialogOpen}
          editDialogOpen={editDialogOpen}
          setEditDialogOpen={setEditDialogOpen}
          editingFeature={editingFeature}
          formData={formData}
          setFormData={setFormData}
          onAddFeature={onAddFeature}
          onUpdateFeature={onUpdateFeature}
          onEditFeature={onEditFeature}
          onResetForm={onResetForm}
        />
      </>
    )
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddCategory={onAddCategory}
          onManageCategories={onManageCategories}
        />

        {categories.length > 0 && (
          <Card className="border-border bg-card mt-2">
            <CardContent className="p-4 sm:p-6 min-h-[400px]">
              <TabsContents>
                {categories.map(category => (
                  <TabsContent key={category.id} value={category.id} className="space-y-4 outline-none">
                    {renderCategoryContent(category)}
                  </TabsContent>
                ))}
              </TabsContents>
            </CardContent>
          </Card>
        )}
      </Tabs>

      {/* Dialogs are rendered once at the root, not inside the loop */}
      <FeatureDialogs
        categories={categories}
        currentCategoryId={activeTab} // Use activeTab as current context
        addDialogOpen={addDialogOpen}
        setAddDialogOpen={setAddDialogOpen}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editingFeature={editingFeature}
        formData={formData}
        setFormData={setFormData}
        onAddFeature={onAddFeature}
        onUpdateFeature={onUpdateFeature}
        onEditFeature={onEditFeature}
        onResetForm={onResetForm}
      />
    </>
  )
}