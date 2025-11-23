import React from 'react'
import { Tabs, TabsContent, TabsContents } from '@/components/animate-ui/components/radix/tabs'
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
    // АДАПТАЦИЯ: mt-2 для мобильных (отступ от кнопок табов), -mt-4 для десктопа (эффект склеивания)
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2 sm:-mt-4">
      <CategoryTabs
        categories={categories}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAddCategory={onAddCategory}
        onManageCategories={onManageCategories}
        canCreate={canCreate}
      />

      {categories.length > 0 && (
        <TabsContents>
          {categories.map(category => (
            // АДАПТАЦИЯ: mt-2 для мобильных, mt-0 для десктопа
            <TabsContent key={category.id} value={category.id} className="mt-2 sm:mt-0">
              <Card>
                <CardHeader className="pb-3 sm:pb-0">
                  {/* АДАПТАЦИЯ: flex-col на мобильных, flex-row на десктопе */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                    <div className="pr-0 sm:pr-4">
                      <CardTitle className="text-base">{category.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs break-words">
                        {category.description}
                      </CardDescription>
                    </div>
                    
                    {/* Контейнер для кнопки добавления фичи */}
                    <div className="shrink-0">
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
                  </div>
                </CardHeader>
                
                {/* АДАПТАЦИЯ: Убран отрицательный отступ на мобильных, так как макет вертикальный */}
                <CardContent className="pt-0 pb-4 sm:-mt-3">
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
        </TabsContents>
      )}
    </Tabs>
  )
}