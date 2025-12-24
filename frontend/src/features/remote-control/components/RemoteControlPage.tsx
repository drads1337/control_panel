import React, { useState } from 'react'
import { Search, CirclePlus, Edit, Trash2, MoreVertical, Loader2, AlertCircle, ChevronDown, History, BarChart, Plus, Settings2 } from 'lucide-react'
import { Input } from '@/shared/ui/components/input'
import { Button } from '@/shared/ui/components/button'
import { Card } from '@/shared/ui/components/card'
import { Badge } from '@/shared/ui/components/badge'
import { Switch } from '@/shared/ui/components/switch'
import { Label } from '@/shared/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/shared/ui/components/dialog'
import { Textarea } from '@/shared/ui/components/textarea'
import { useRemoteControlLogic } from '../hooks/use-remote-control-logic'
import { cn } from '@/shared/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/components/dropdown-menu'

export function RemoteControlPage() {
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
    setEditingFeature,
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
    canCreate,
    canEdit,
    canDelete,
    canToggle,
    canView
  } = useRemoteControlLogic()

  const [searchQuery, setSearchQuery] = useState('')
  const [deleteFeatureDialogOpen, setDeleteFeatureDialogOpen] = useState(false)
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false)
  const [featureToDelete, setFeatureToDelete] = useState<string | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)

  const handleDeleteFeatureClick = (featureId: string) => {
    setFeatureToDelete(featureId)
    setDeleteFeatureDialogOpen(true)
  }

  const handleDeleteFeatureConfirm = async () => {
    if (featureToDelete) {
      await handleDeleteFeature(featureToDelete)
      setDeleteFeatureDialogOpen(false)
      setFeatureToDelete(null)
    }
  }

  const handleDeleteCategoryClick = (categoryId: string) => {
    setCategoryToDelete(categoryId)
    setDeleteCategoryDialogOpen(true)
  }

  const handleDeleteCategoryConfirm = async () => {
    if (categoryToDelete) {
      await handleDeleteCategory(categoryToDelete)
      setDeleteCategoryDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  const [featureFilter, setFeatureFilter] = useState<'all' | 'online' | 'offline'>('all')

  const activeCategory = categories.find(cat => cat.id === activeTab)
  const activeFeatures = activeCategory ? getCategoryFeatures(activeTab) : []

  const filteredFeatures = activeFeatures.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (featureFilter === 'all') return matchesSearch
    if (featureFilter === 'online') return matchesSearch && feature.status === 'online'
    if (featureFilter === 'offline') return matchesSearch && (feature.status === 'offline' || feature.status === 'error')
    return matchesSearch
  })

  const onlineCount = activeFeatures.filter(f => f.status === 'online').length
  const offlineCount = activeFeatures.filter(f => f.status === 'offline' || f.status === 'error').length

  // Helper function to get status display
  const getStatusDisplay = (status: string) => {
    if (status === 'online') return 'ONLINE'
    if (status === 'offline') return 'OFFLINE'
    return 'MAINTENANCE'
  }

  // Helper function to format usage count
  const formatUsageCount = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count)
  }

  // Helper function to get feature icon (placeholder - you can enhance this)
  const getFeatureIcon = (feature: any) => Settings2

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]">
        <div className="p-6 bg-surface-dark border border-border-dark rounded-sm">
          <div className="flex items-center gap-3 text-text-secondary-dark">
            <AlertCircle className="h-5 w-5" />
            <span>You don't have permission to view remote control</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)] border border-border-dark rounded-sm overflow-hidden bg-background-dark shadow-sm">
      {/* Sidebar - Categories */}
      <div className="w-64 border-r border-border-dark flex flex-col bg-surface-dark/5">
        {/* Header */}
        <div className="p-3 border-b border-border-dark flex items-center justify-between bg-surface-dark/50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-wider">Categories</span>
            <span className="bg-background-dark border border-border-dark px-1 py-0.5 rounded text-[8px] text-text-secondary-dark font-mono">
              {categories.length}
            </span>
          </div>
          {canCreate && (
            <Button
              onClick={() => {
                resetCategoryForm()
                setEditingCategory(null)
                setCategoryDialogOpen(true)
              }}
              variant="ghost"
              size="icon"
              className="text-text-secondary-dark hover:text-white h-auto w-auto p-0"
              title="Add category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-text-secondary-dark" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-2.5 text-text-secondary-dark text-[10px]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-6 text-text-secondary-dark text-[10px]">
              No categories yet
            </div>
          ) : (
            categories.map((category) => {
              const categoryStats = stats.find(s => s.category.id === category.id)
              const isActive = activeTab === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-sm border transition-all flex items-start gap-2.5 group",
                    isActive
                      ? "bg-surface-dark border-border-dark shadow-sm"
                      : "border-transparent hover:bg-white/5"
                  )}
                >
                  <div 
                    className={cn(
                      "mt-0.5 w-1.5 h-1.5 rounded-full",
                      isActive 
                        ? "shadow-[0_0_6px_rgba(59,130,246,0.5)]" 
                        : ""
                    )}
                    style={{ backgroundColor: isActive ? category.color || '#3b82f6' : '#2D333B' }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-[11px] font-bold",
                      isActive
                        ? "text-white"
                        : "text-text-secondary-dark group-hover:text-text-primary-dark"
                    )}>
                      {category.name}
                    </div>
                    <div className="text-[9px] text-text-secondary-dark opacity-60 font-mono mt-0.5">
                      {categoryStats ? `${categoryStats.enabled}/${categoryStats.total} enabled` : '0/0 enabled'}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#0F1115] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{ 
          backgroundImage: 'radial-gradient(#2D333B 1px, transparent 1px)', 
          backgroundSize: '20px 20px', 
          opacity: 0.08 
        }}></div>

        {/* Top Toolbar */}
        <div className="relative z-10 px-4 py-3 flex items-center justify-between border-b border-border-dark/50">
          <div className="flex items-center gap-2">
            {products.length > 0 && (
              <Select 
                value={selectedProductId ? String(selectedProductId) : ''} 
                onValueChange={(value) => handleProductChange(Number(value))}
                disabled={productsLoading}
              >
                <SelectTrigger className="w-full min-w-[200px] bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[28px]">
                  <SelectValue placeholder={productsLoading ? "Loading..." : "Select product"} />
                </SelectTrigger>
                <SelectContent 
                  className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                  position="popper"
                >
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedProductId && activeCategory && (
              <>
                <span className="text-text-secondary-dark text-[10px]">/</span>
                <div className="flex items-center gap-1 text-xs font-bold text-white">
                  {activeCategory.name}
                </div>
              </>
            )}
            {selectedProductId && !activeCategory && (
              <div className="text-xs font-bold text-text-secondary-dark">
                Select Category
              </div>
            )}
          </div>
          {canCreate && activeCategory && (
            <Button 
              className="bg-primary hover:bg-primary-hover text-background-dark px-2.5 py-1 rounded-sm text-[9px] font-bold flex items-center gap-1.5 transition-all shadow-glow h-[28px]"
              onClick={() => {
                resetForm()
                setEditingFeature(null)
                setFormData(prev => ({ ...prev, category_id: activeTab }))
                setAddDialogOpen(true)
              }}
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Add Feature
            </Button>
          )}
        </div>

        {/* Content Body */}
        {activeCategory ? (
          <div className="relative z-10 flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white mb-1">{activeCategory.name}</h2>
              {activeCategory.description && (
                <p className="text-[11px] text-text-secondary-dark max-w-2xl">
                  {activeCategory.description}
                </p>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between mb-3 bg-surface-dark/30 p-1.5 rounded border border-border-dark/50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setFeatureFilter('all')}
                  className={cn(
                    "text-[10px] font-bold border-b-2 pb-1 transition-colors",
                    featureFilter === 'all'
                      ? "text-white border-white"
                      : "text-text-secondary-dark hover:text-white border-transparent hover:border-border-dark"
                  )}
                >
                  All ({activeFeatures.length})
                </button>
                <button 
                  onClick={() => setFeatureFilter('online')}
                  className={cn(
                    "text-[10px] font-bold border-b-2 pb-1 transition-colors",
                    featureFilter === 'online'
                      ? "text-white border-white"
                      : "text-text-secondary-dark hover:text-white border-transparent hover:border-border-dark"
                  )}
                >
                  Online ({onlineCount})
                </button>
                <button 
                  onClick={() => setFeatureFilter('offline')}
                  className={cn(
                    "text-[10px] font-bold border-b-2 pb-1 transition-colors",
                    featureFilter === 'offline'
                      ? "text-white border-white"
                      : "text-text-secondary-dark hover:text-white border-transparent hover:border-border-dark"
                  )}
                >
                  Offline ({offlineCount})
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative group w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Search className="h-3.5 w-3.5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                  </span>
                  <Input 
                    className="w-full bg-background-dark border border-border-dark rounded-sm pl-9 pr-3 py-1.5 text-[10px] text-text-secondary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/40 h-auto" 
                    placeholder="Search features..." 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-secondary-dark">
                  <History className="h-3.5 w-3.5" />
                  Just now
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="space-y-2">
              {filteredFeatures.length === 0 ? (
                <div className="text-center py-6 text-text-secondary-dark text-[10px]">
                  No features found
                </div>
              ) : (
                filteredFeatures.map((feature) => {
                  const FeatureIcon = getFeatureIcon(feature)
                  const statusDisplay = getStatusDisplay(feature.status || 'offline')
                  const isOnline = feature.status === 'online'
                  const isMaintenance = feature.status === 'error'
                  
                  return (
                    <Card 
                      key={feature.id} 
                      className="bg-surface-dark border border-border-dark rounded-sm p-3 flex items-center justify-between group hover:border-text-secondary-dark/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center text-text-secondary-dark group-hover:text-primary transition-colors shadow-sm">
                          <FeatureIcon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-text-primary-dark truncate font-display">{feature.name}</h3>
                            <Badge className={cn(
                              "text-[9px] font-bold px-1 py-px rounded-[2px] border uppercase tracking-wider",
                              isOnline 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isMaintenance
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                            )}>
                              {statusDisplay}
                            </Badge>
                          </div>
                          {feature.description && (
                            <p className="text-[10px] text-text-secondary-dark truncate">{feature.description}</p>
                          )}
                          <div className="flex items-center gap-2.5 text-[9px] text-text-secondary-dark font-mono leading-none mt-0.5">
                            <span className="opacity-60">ID: <span className="text-text-primary-dark opacity-100">{feature.id}</span></span>
                            {feature.usage_count !== undefined && (
                              <>
                                <span className="w-px h-2 bg-border-dark"></span>
                                <span className="flex items-center gap-1 opacity-60">
                                  <BarChart className="h-3 w-3" />
                                  Used {formatUsageCount(feature.usage_count)} times
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {canToggle && (
                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wider",
                              feature.enabled ? "text-white" : "text-text-secondary-dark"
                            )}>
                              {feature.enabled ? 'ON' : 'OFF'}
                            </span>
                            {/* Custom Toggle Switch */}
                            <div 
                              onClick={() => canToggle && handleFeatureToggle(feature.id)}
                              className={cn(
                                "w-9 h-4.5 rounded-full relative cursor-pointer transition-colors",
                                feature.enabled ? "bg-blue-600" : "bg-border-dark"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
                                feature.enabled ? "left-5" : "left-0.5"
                              )}></div>
                            </div>
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark border border-transparent hover:border-border-dark"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-surface-dark border-border-dark">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => handleEditFeature(feature)}
                                className="text-text-primary-dark hover:bg-white/10"
                              >
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteFeatureClick(feature.id)}
                                className="text-text-primary-dark hover:bg-red-500/20 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className="text-center text-text-secondary-dark">
              <p className="text-xs mb-2">Select a category to view features</p>
              {categories.length === 0 && canCreate && (
                <Button
                  className="mt-3 bg-primary hover:bg-primary-hover text-background-dark px-2.5 py-1 rounded-sm text-[9px] font-bold flex items-center gap-1.5 transition-all shadow-glow h-[28px] mx-auto"
                  onClick={() => {
                    resetCategoryForm()
                    setEditingCategory(null)
                    setCategoryDialogOpen(true)
                  }}
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  Create First Category
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Feature Dialog */}
      <Dialog open={addDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setAddDialogOpen(false)
          setEditDialogOpen(false)
          setEditingFeature(null)
          resetForm()
        }
      }}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-text-primary-dark">{editingFeature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              {editingFeature ? 'Update feature details' : 'Create a new remote control feature'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feature-name" className="text-text-secondary-dark">Name *</Label>
              <Input
                id="feature-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark"
                placeholder="Feature name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feature-description" className="text-text-secondary-dark">Description *</Label>
              <Textarea
                id="feature-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark"
                placeholder="Feature description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feature-category" className="text-text-secondary-dark">Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent 
                  className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                  position="popper"
                >
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="feature-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
              <Label htmlFor="feature-enabled" className="text-text-secondary-dark cursor-pointer">
                Enabled by default
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setEditDialogOpen(false)
                setEditingFeature(null)
                resetForm()
              }}
              className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={editingFeature ? handleUpdateFeature : handleAddFeature}
              className="bg-primary hover:bg-primary-hover text-background-dark"
            >
              {editingFeature ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-text-primary-dark">{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              {editingCategory ? 'Update category details' : 'Create a new category for features'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name" className="text-text-secondary-dark">Name *</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark"
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description" className="text-text-secondary-dark">Description *</Label>
              <Textarea
                id="category-description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark"
                placeholder="Category description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-color" className="text-text-secondary-dark">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="category-color"
                  type="color"
                  value={categoryFormData.color}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-10 bg-background-dark border-border-dark"
                />
                <Input
                  value={categoryFormData.color}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 bg-background-dark border-border-dark text-text-primary-dark"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryDialogOpen(false)
                setEditingCategory(null)
                resetCategoryForm()
              }}
              className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
              className="bg-primary hover:bg-primary-hover text-background-dark"
            >
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Feature Confirmation Dialog */}
      <Dialog open={deleteFeatureDialogOpen} onOpenChange={setDeleteFeatureDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-text-primary-dark">Delete Feature</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              Are you sure you want to delete this feature? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteFeatureDialogOpen(false)
                setFeatureToDelete(null)
              }}
              className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteFeatureConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      <Dialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-text-primary-dark">Delete Category</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              Are you sure you want to delete this category? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteCategoryDialogOpen(false)
                setCategoryToDelete(null)
              }}
              className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCategoryConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

