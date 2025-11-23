import React, { useState, useEffect } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Settings, AlertCircle, RefreshCw, Database, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  remoteControlAPI,
  RemoteCategory,
  RemoteFeature,
  CategoryStats
} from '@/lib/remote-control-api'
import { getProducts } from '@/entities/product/api/product'
import { getErrorMessage, isAxiosError } from '@/lib/error-utils'
import type { Product } from '@/entities/product'
import RemoteControlStatsCards from './remote-control-stats-cards'
import RemoteControlTabs from './remote-control-tabs'
import CategoryDialog from './category-dialog'

export default function RemoteControl() {
  const { user, token } = useAuthContext()
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')
  const [features, setFeatures] = useState<RemoteFeature[]>([])
  const [categories, setCategories] = useState<RemoteCategory[]>([])
  const [stats, setStats] = useState<CategoryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<RemoteFeature | null>(null)
  const [editingCategory, setEditingCategory] = useState<RemoteCategory | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    enabled: false
  })

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    product_id: 0
  })

  const { hasPermission } = usePermissions()

  const loadProducts = async () => {
    try {
      setProductsLoading(true)
      const response = await getProducts('all')
      setProducts(response.products || [])
      if (response.products && response.products.length > 0 && !selectedProductId) {
        setSelectedProductId(response.products[0].id)
      }
    } catch (err: unknown) {
      toast.error('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  const loadData = async () => {
    if (!selectedProductId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [categoriesData, featuresData, statsData] = await Promise.all([
        remoteControlAPI.getCategories(selectedProductId),  // Uses product_id internally
        remoteControlAPI.getFeatures(selectedProductId),  // Uses product_id internally
        remoteControlAPI.getStats(selectedProductId)  // Uses product_id internally
      ])

      setCategories(categoriesData)
      setFeatures(featuresData)
      setStats(statsData)

      if (categoriesData.length > 0 && !activeTab) {
        setActiveTab(categoriesData[0].id)
      }

    } catch (err: unknown) {
      let errorMessage = 'Failed to load data'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedProductId])

  const handleFeatureToggle = async (featureId: string) => {
    if (!hasPermission('remote_control.toggle')) {
      toast.error("You don't have permission to toggle features")
      return
    }

    try {
      const updatedFeature = await remoteControlAPI.toggleFeature(featureId)
      setFeatures(prev => prev.map(feature =>
        feature.id === featureId ? updatedFeature : feature
      ))

      toast.success(`${updatedFeature.name} ${updatedFeature.enabled ? 'enabled' : 'disabled'} for all clients`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to toggle feature'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const handleAddFeature = async () => {
    if (!hasPermission('remote_control.create')) {
      toast.error("You don't have permission to create features")
      return
    }

    if (!formData.name.trim() || !formData.description.trim() || !formData.category_id) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const newFeature = await remoteControlAPI.createFeature({
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id,
        enabled: formData.enabled
      })

      setFeatures(prev => [...prev, newFeature])
      setAddDialogOpen(false)
      resetForm()

      toast.success(`${formData.name} successfully added`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to create feature'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const handleEditFeature = (feature: RemoteFeature) => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit features")
      return
    }

    setEditingFeature(feature)
    setFormData({
      name: feature.name,
      description: feature.description,
      category_id: feature.category,
      enabled: feature.enabled
    })
    setEditDialogOpen(true)
  }

  const handleUpdateFeature = async () => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit features")
      return
    }

    if (!formData.name.trim() || !formData.description.trim() || !editingFeature || !formData.category_id) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const updatedFeature = await remoteControlAPI.updateFeature(editingFeature.id, {
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id,
        enabled: formData.enabled
      })

      setFeatures(prev => prev.map(feature =>
        feature.id === editingFeature.id ? updatedFeature : feature
      ))

      setEditDialogOpen(false)
      setEditingFeature(null)
      resetForm()

      toast.success(`${formData.name} successfully updated`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to update feature'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const handleDeleteFeature = async (featureId: string) => {
    if (!hasPermission('remote_control.delete')) {
      toast.error("You don't have permission to delete features")
      return
    }

    const feature = features.find(f => f.id === featureId)

    try {
      await remoteControlAPI.deleteFeature(featureId)
      setFeatures(prev => prev.filter(f => f.id !== featureId))

      toast.success(`${feature?.name} removed from the system`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to delete feature'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category_id: '',
      enabled: false
    })
  }

  const handleAddCategory = async () => {
    if (!hasPermission('remote_control.create')) {
      toast.error("You don't have permission to create sections")
      return
    }

    if (!selectedProductId) {
      toast.error("Please select a product first")
      return
    }

    if (!categoryFormData.name.trim() || !categoryFormData.description.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const newCategory = await remoteControlAPI.createCategory({
        name: categoryFormData.name,
        description: categoryFormData.description,
        color: categoryFormData.color,
        product_id: selectedProductId  // Use universal parameter
      })

      setCategories(prev => [...prev, newCategory])
      setCategoryDialogOpen(false)
      resetCategoryForm()

      toast.success(`${categoryFormData.name} successfully added`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to create category'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const handleEditCategory = (category: RemoteCategory) => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit sections")
      return
    }

    setEditingCategory(category)
    setCategoryFormData({
      name: category.name,
      description: category.description,
      color: category.color,
      product_id: category.product_id ? parseInt(category.product_id) : selectedProductId || 0
    })
    setCategoryDialogOpen(true)
  }

  const handleUpdateCategory = async () => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit sections")
      return
    }

    if (!categoryFormData.name.trim() || !categoryFormData.description.trim() || !editingCategory) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const updatedCategory = await remoteControlAPI.updateCategory(editingCategory.id, {
        name: categoryFormData.name,
        description: categoryFormData.description,
        color: categoryFormData.color,
        product_id: selectedProductId || undefined  // Use universal parameter
      })

      setCategories(prev => prev.map(category =>
        category.id === editingCategory.id ? updatedCategory : category
      ))

      setCategoryDialogOpen(false)
      setEditingCategory(null)
      resetCategoryForm()

      toast.success(`${categoryFormData.name} successfully updated`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to update category'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!hasPermission('remote_control.delete')) {
      toast.error("You don't have permission to delete sections")
      return
    }

    const category = categories.find(c => c.id === categoryId)

    const featuresInCategory = features.filter(f => f.category === categoryId)
    if (featuresInCategory.length > 0) {
      toast.error(`Cannot delete a category with features. First, delete or move ${featuresInCategory.length} features.`)
      return
    }

    try {
      await remoteControlAPI.deleteCategory(categoryId)
      setCategories(prev => prev.filter(c => c.id !== categoryId))

      toast.success(`${category?.name} removed from the system`)
    } catch (err: unknown) {
      let errorMessage = 'Failed to delete category'
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage)
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      product_id: selectedProductId || 0
    })
  }

  const getCategoryFeatures = (categoryId: string) => {
    return features.filter(feature => feature.category === categoryId)
  }

  if (!hasPermission('remote_control.view')) {
    return (
      <div className="p-1 sm:p-0">
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Remote Control
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage online features for mods and cheats for clients
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">Access Denied</div>
                <p className="text-xs text-muted-foreground mt-1">
                  You don't have permission to access remote control features.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-1 sm:p-0">
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Remote Control
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage online features for mods and cheats for clients
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadData}
                className="ml-auto h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-1 sm:p-0">
      <div className="mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Remote Control
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage online features for mods and cheats for clients
        </p>
      </div>
      <Card>
        {/* АДАПТАЦИЯ: p-4 для мобильных, desktop стили с -mb-4 для "вдавленного" вида табов */}
        <CardHeader className="border-b bg-muted/30 pt-3 px-4 pb-3 sm:pb-0 sm:px-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Группа Select и Иконки: flex-1 позволяет растягиваться */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* Иконка */}
                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 sm:pt-1 sm:-mb-4">
                  <Database className="h-4 w-4" />
                </div>
                
                {/* Селект: w-full на мобильном, w-[280px] на ПК */}
                <div className="flex-1 sm:flex-none sm:pt-1 sm:-mb-4 min-w-0">
                  <Select
                    value={selectedProductId?.toString() || ''}
                    onValueChange={(value) => {
                      setSelectedProductId(parseInt(value))
                      setActiveTab('')
                    }}
                    disabled={productsLoading}
                  >
                    <SelectTrigger id="product-select" className="w-full sm:w-[280px] h-9 border-border/50 bg-background !mt-0 !mb-0">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Кнопка обновления: shrink-0 чтобы не исчезала */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={loadData}
              disabled={loading || !selectedProductId}
              className="shrink-0 sm:pt-1 sm:-mb-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        
        {/* АДАПТАЦИЯ: p-4 для мобильных чтобы был отступ, sm:pt-0 чтобы табы прилегали к хедеру */}
        <CardContent className="p-4 sm:pt-0 sm:pb-4">
          {!selectedProductId ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">Please select a product to manage remote control features</div>
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
              canCreate={hasPermission('remote_control.create')}
              canEdit={hasPermission('remote_control.edit')}
              canDelete={hasPermission('remote_control.delete')}
              canToggle={hasPermission('remote_control.toggle')}
            />
          )}
        </CardContent>
      </Card>

      {selectedProductId && !loading && categories.length > 0 && (
        <div className="mt-6">
           {/* Обертка для статистики, если компонент сам не поддерживает адаптивность */}
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
          canCreate={hasPermission('remote_control.create')}
          canEdit={hasPermission('remote_control.edit')}
          canDelete={hasPermission('remote_control.delete')}
        />
      )}
    </div>
  )
}