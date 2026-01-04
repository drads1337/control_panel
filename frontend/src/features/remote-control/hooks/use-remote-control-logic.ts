import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/app/providers/auth-provider'
import { usePermissions } from '@/shared/hooks'
import { toast } from 'sonner'
import {
  remoteControlAPI,
  RemoteCategory,
  RemoteFeature,
  CategoryStats
} from '@/shared/lib/remote-control-api'
import { getProducts } from '@/entities/product/api/product'
import { getErrorMessage, isAxiosError } from '@/shared/lib/utils/error-utils'
import type { Product } from '@/entities/product'

export type FeatureType = 'toggle' | 'slider' | 'int-slider' | 'float-slider' | 'select'
export type FeatureStatus = 'offline' | 'online' | 'maintenance'

export interface FeatureFormData {
  name: string
  description: string
  category_id: string
  enabled: boolean
  status: FeatureStatus
  type: FeatureType
  min?: number
  max?: number
  step?: number
  defaultValue?: string | number | boolean
  options?: string // comma-separated for select type
}

interface CategoryFormData {
  name: string
  description: string
  color: string
  product_id?: number
}

export function useRemoteControlLogic() {
  const { user, token } = useAuthContext()
  const { hasPermission } = usePermissions()

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

  const [formData, setFormData] = useState<FeatureFormData>({
    name: '',
    description: '',
    category_id: '',
    enabled: false,
    status: 'offline',
    type: 'toggle'
  })

  const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#3b82f6',
    product_id: undefined
  })

  const loadProducts = useCallback(async () => {
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
  }, [selectedProductId])

  const loadData = useCallback(async () => {
    if (!selectedProductId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [categoriesData, featuresData, statsData] = await Promise.all([
        remoteControlAPI.getCategories(selectedProductId),
        remoteControlAPI.getFeatures(selectedProductId),
        remoteControlAPI.getStats(selectedProductId)
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
  }, [selectedProductId, activeTab])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleFeatureToggle = useCallback(async (featureId: string) => {
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
  }, [hasPermission])

  const buildConfiguration = useCallback((formData: FeatureFormData): Record<string, any> => {
    const config: Record<string, any> = {
      type: formData.type
    }

    if (formData.type === 'slider' || formData.type === 'int-slider' || formData.type === 'float-slider') {
      if (formData.min !== undefined) config.min = formData.min
      if (formData.max !== undefined) config.max = formData.max
      if (formData.step !== undefined) config.step = formData.step
      if (formData.defaultValue !== undefined && formData.defaultValue !== '') {
        config.default = typeof formData.defaultValue === 'string' 
          ? parseFloat(formData.defaultValue as string) 
          : formData.defaultValue
      }
    } else if (formData.type === 'select') {
      if (formData.options && formData.options.trim()) {
        config.options = formData.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)
      }
      if (formData.defaultValue !== undefined && formData.defaultValue !== '') {
        config.default = formData.defaultValue
      }
    } else if (formData.type === 'toggle') {
      if (formData.defaultValue !== undefined) {
        config.default = formData.defaultValue === 'true' || formData.defaultValue === true
      }
    }

    return config
  }, [])

  const handleAddFeature = useCallback(async () => {
    if (!hasPermission('remote_control.create')) {
      toast.error("You don't have permission to create features")
      return
    }

    if (!formData.name.trim() || !formData.description.trim() || !formData.category_id) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const configuration = buildConfiguration(formData)
      const newFeature = await remoteControlAPI.createFeature({
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id,
        enabled: formData.enabled,
        status: formData.status,
        configuration: Object.keys(configuration).length > 1 ? configuration : undefined // Only send if has more than just type
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
  }, [formData, hasPermission, buildConfiguration])

  const handleEditFeature = useCallback((feature: RemoteFeature) => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit features")
      return
    }

    setEditingFeature(feature)
    const config = feature.configuration || {}
    const formData: FeatureFormData = {
      name: feature.name,
      description: feature.description || '',
      category_id: feature.category,
      enabled: feature.enabled,
      status: (feature.status as FeatureStatus) || 'offline',
      type: (config.type as FeatureType) || 'toggle'
    }

    if (formData.type === 'slider' || formData.type === 'int-slider' || formData.type === 'float-slider') {
      if (config.min !== undefined) formData.min = config.min
      if (config.max !== undefined) formData.max = config.max
      if (config.step !== undefined) formData.step = config.step
      if (config.default !== undefined) formData.defaultValue = config.default
    } else if (formData.type === 'select') {
      if (Array.isArray(config.options)) {
        formData.options = config.options.join(', ')
      }
      if (config.default !== undefined) formData.defaultValue = config.default
    } else if (formData.type === 'toggle') {
      if (config.default !== undefined) formData.defaultValue = config.default
    }

    setFormData(formData)
    setAddDialogOpen(true) // Use addDialogOpen for feature dialog
  }, [hasPermission])

  const handleUpdateFeature = useCallback(async () => {
    if (!hasPermission('remote_control.edit')) {
      toast.error("You don't have permission to edit features")
      return
    }

    if (!formData.name.trim() || !formData.description.trim() || !editingFeature || !formData.category_id) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const configuration = buildConfiguration(formData)
      const updatedFeature = await remoteControlAPI.updateFeature(editingFeature.id, {
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id,
        enabled: formData.enabled,
        status: formData.status,
        configuration: Object.keys(configuration).length > 1 ? configuration : undefined
      })

      setFeatures(prev => prev.map(feature =>
        feature.id === editingFeature.id ? updatedFeature : feature
      ))

      setAddDialogOpen(false) // Use addDialogOpen for feature dialog
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
  }, [formData, editingFeature, hasPermission, buildConfiguration])

  const handleDeleteFeature = useCallback(async (featureId: string) => {
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
  }, [features, hasPermission])

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      category_id: '',
      enabled: false,
      status: 'offline',
      type: 'toggle'
    })
    setEditingFeature(null)
  }, [])

  const handleAddCategory = useCallback(async () => {
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
        product_id: selectedProductId
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
  }, [categoryFormData, selectedProductId, hasPermission])

  const handleEditCategory = useCallback((category: RemoteCategory) => {
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
  }, [selectedProductId, hasPermission])

  const handleUpdateCategory = useCallback(async () => {
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
        product_id: selectedProductId || undefined
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
  }, [categoryFormData, editingCategory, selectedProductId, hasPermission])

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
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
  }, [categories, features, hasPermission])

  const resetCategoryForm = useCallback(() => {
    setCategoryFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      product_id: selectedProductId || undefined
    })
  }, [selectedProductId])

  const getCategoryFeatures = useCallback((categoryId: string) => {
    return features.filter(feature => feature.category === categoryId)
  }, [features])

  const handleProductChange = useCallback((productId: number) => {
    setSelectedProductId(productId)
    setActiveTab('')
    // Update category form data with new product ID
    setCategoryFormData(prev => ({
      ...prev,
      product_id: productId
    }))
  }, [])

  return {
    // State
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
    setEditingFeature,
    editingCategory,
    setEditingCategory,
    formData,
    setFormData,
    categoryFormData,
    setCategoryFormData,
    
    // Actions
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
    
    // Permissions
    canCreate: hasPermission('remote_control.create'),
    canEdit: hasPermission('remote_control.edit'),
    canDelete: hasPermission('remote_control.delete'),
    canToggle: hasPermission('remote_control.toggle'),
    canView: hasPermission('remote_control.view')
  }
}
