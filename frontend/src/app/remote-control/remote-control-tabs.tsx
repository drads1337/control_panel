import React from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import CategoryTabs from './category-tabs'
import FeatureList from './feature-list'
import FeatureDialogs from './feature-dialogs'
import { RemoteCategory, RemoteFeature } from '@/lib/remote-control-api'

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
  setFormData: (data: any) => void
  onAddCategory: () => void
  onManageCategories: () => void
  onFeatureToggle: (featureId: string) => void
  onEditFeature: (feature: RemoteFeature) => void
  onDeleteFeature: (featureId: string) => void
  onAddFeature: () => void
  onUpdateFeature: () => void
  getCategoryFeatures: (categoryId: string) => RemoteFeature[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canToggle: boolean
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
  getCategoryFeatures,
  canCreate,
  canEdit,
  canDelete,
  canToggle
}: RemoteControlTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full -mt-4">
      <CategoryTabs
        categories={categories}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAddCategory={onAddCategory}
        onManageCategories={onManageCategories}
        canCreate={canCreate}
      />

      {categories.length > 0 && (
        <>
          {categories.map(category => (
            <TabsContent key={category.id} value={category.id} className="mt-0">
              <Card>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{category.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {category.description}
                      </CardDescription>
                    </div>
                    <FeatureDialogs
                      categories={categories}
                      currentCategoryId={category.id}
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
                      canCreate={canCreate}
                      canEdit={canEdit}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4 -mt-3">
                  <FeatureList
                    features={getCategoryFeatures(category.id)}
                    loading={loading}
                    onFeatureToggle={onFeatureToggle}
                    onEditFeature={onEditFeature}
                    onDeleteFeature={onDeleteFeature}
                    onAddFeature={() => {
                      setFormData((prev: any) => ({ ...prev, category_id: category.id }))
                      setAddDialogOpen(true)
                    }}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canToggle={canToggle}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </>
      )}
    </Tabs>
  )
}
