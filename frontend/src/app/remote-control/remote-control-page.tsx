import React, { useState, useEffect } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import {
  remoteControlAPI,
  RemoteCategory,
  RemoteFeature,
  CategoryStats
} from '@/lib/remote-control-api'
import RemoteControlStatsCards from './remote-control-stats-cards'
import RemoteControlTabs from './remote-control-tabs'
import CategoryDialog from './category-dialog'

export default function RemoteControl() {
  const { user, token } = useAuthContext()
  const [activeTab, setActiveTab] = useState('')
  const [features, setFeatures] = useState<RemoteFeature[]>([])
  const [categories, setCategories] = useState<RemoteCategory[]>([])
  const [stats, setStats] = useState<CategoryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<RemoteFeature | null>(null)
  const [editingCategory, setEditingCategory] = useState<RemoteCategory | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    enabled: false
  })

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6'
  })

  // Permissions check
  const { hasPermission } = usePermissions()

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [categoriesData, featuresData, statsData] = await Promise.all([
        remoteControlAPI.getCategories(),
        remoteControlAPI.getFeatures(),
        remoteControlAPI.getStats()
      ])

      setCategories(categoriesData)
      setFeatures(featuresData)
      setStats(statsData)

      // Set active tab to first category if none selected
      if (categoriesData.length > 0 && !activeTab) {
        setActiveTab(categoriesData[0].id)
      }

    } catch (err: any) {
      console.error('Error loading remote control data:', err)
      setError(err.response?.data?.error || 'Failed to load data')
      toast.error(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
    } catch (err: any) {
      console.error('Error toggling feature:', err)
      toast.error(err.response?.data?.error || 'Failed to toggle feature')
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
    } catch (err: any) {
      console.error('Error creating feature:', err)
      toast.error(err.response?.data?.error || 'Failed to create feature')
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
    } catch (err: any) {
      console.error('Error updating feature:', err)
      toast.error(err.response?.data?.error || 'Failed to update feature')
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
    } catch (err: any) {
      console.error('Error deleting feature:', err)
      toast.error(err.response?.data?.error || 'Failed to delete feature')
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

    if (!categoryFormData.name.trim() || !categoryFormData.description.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const newCategory = await remoteControlAPI.createCategory({
        name: categoryFormData.name,
        description: categoryFormData.description,
        color: categoryFormData.color
      })

      setCategories(prev => [...prev, newCategory])
      setCategoryDialogOpen(false)
      resetCategoryForm()

      toast.success(`${categoryFormData.name} successfully added`)
    } catch (err: any) {
      console.error('Error creating category:', err)
      toast.error(err.response?.data?.error || 'Failed to create category')
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
      color: category.color
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
        color: categoryFormData.color
      })

      setCategories(prev => prev.map(category =>
        category.id === editingCategory.id ? updatedCategory : category
      ))

      setCategoryDialogOpen(false)
      setEditingCategory(null)
      resetCategoryForm()

      toast.success(`${categoryFormData.name} successfully updated`)
    } catch (err: any) {
      console.error('Error updating category:', err)
      toast.error(err.response?.data?.error || 'Failed to update category')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!hasPermission('remote_control.delete')) {
      toast.error("You don't have permission to delete sections")
      return
    }

    const category = categories.find(c => c.id === categoryId)

    // Check if there are features in this category
    const featuresInCategory = features.filter(f => f.category === categoryId)
    if (featuresInCategory.length > 0) {
      toast.error(`Cannot delete a category with features. First, delete or move ${featuresInCategory.length} features.`)
      return
    }

    try {
      await remoteControlAPI.deleteCategory(categoryId)
      setCategories(prev => prev.filter(c => c.id !== categoryId))

      toast.success(`${category?.name} removed from the system`)
    } catch (err: any) {
      console.error('Error deleting category:', err)
      toast.error(err.response?.data?.error || 'Failed to delete category')
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      color: '#3b82f6'
    })
  }


  const getCategoryFeatures = (categoryId: string) => {
    return features.filter(feature => feature.category === categoryId)
  }

  // Check if user has remote control access via permissions
  if (!hasPermission('remote_control.view')) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Remote Control</h1>
          <p className="text-muted-foreground">
            Manage online features for mods and cheats for clients
          </p>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-6">
              <div className="text-center">
                <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  You don't have permission to access remote control features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Remote Control</h1>
          <p className="text-muted-foreground">
            Manage online features for mods and cheats for clients
          </p>
        </div>

        {/* Error Alert */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-800">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Remote Control</h1>
        <p className="text-muted-foreground">
          Manage online features for mods and cheats for clients
        </p>
      </div>

      {/* Stats Cards */}
      <RemoteControlStatsCards categories={categories} stats={stats} />

      {/* Tabs Interface */}
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

      {/* Category Management Dialog */}
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
    </div>
  )
}