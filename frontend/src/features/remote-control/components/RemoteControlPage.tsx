import React, { useState } from 'react'
import { Search, CirclePlus, Edit, Trash2, Power, Settings, MoreVertical, Loader2, AlertCircle } from 'lucide-react'
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

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const activeCategory = categories.find(cat => cat.id === activeTab)
  const activeFeatures = activeCategory ? getCategoryFeatures(activeTab) : []
  const filteredFeatures = activeFeatures.filter(feature =>
    feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    feature.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Card className="p-6 bg-surface-dark border border-border-dark">
          <div className="flex items-center gap-3 text-text-secondary-dark">
            <AlertCircle className="h-5 w-5" />
            <span>You don't have permission to view remote control</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col gap-4 overflow-hidden p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Search className="h-4 w-4 text-text-secondary-dark" />
            </span>
            <Input 
              className="pl-9 pr-4 py-2 bg-surface-dark border border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark transition-all w-64" 
              placeholder="Search categories and features..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={selectedProductId ? String(selectedProductId) : ''} 
            onValueChange={(value) => handleProductChange(Number(value))}
            disabled={productsLoading}
          >
            <SelectTrigger className="w-48 bg-surface-dark border-border-dark rounded px-3 py-2 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-9">
              <SelectValue placeholder={productsLoading ? "Loading..." : "Select product"} />
            </SelectTrigger>
            <SelectContent className="bg-surface-dark border-border-dark text-text-primary-dark">
              {products.map((product) => (
                <SelectItem key={product.id} value={String(product.id)}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button 
              size="sm" 
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-background-dark rounded text-xs font-bold transition-all"
              onClick={() => {
                resetCategoryForm()
                setEditingCategory(null)
                setCategoryDialogOpen(true)
              }}
            >
              <CirclePlus className="h-4 w-4 mr-1.5" />
              Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Categories Sidebar */}
        <div className="w-64 flex flex-col gap-2 flex-shrink-0 overflow-hidden">
          <Card className="bg-surface-dark border border-border-dark rounded flex-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border-dark flex justify-between items-center bg-white/5">
              <span className="text-[10px] uppercase font-bold text-text-secondary-dark tracking-widest">Categories</span>
              <Badge className="text-[10px] font-mono-numbers text-primary bg-white/5 px-1.5 rounded border border-white/10">
                {categories.length}
              </Badge>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-text-secondary-dark" />
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 p-3 text-text-secondary-dark text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-text-secondary-dark text-xs">
                  {categories.length === 0 ? 'No categories yet' : 'No categories found'}
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const categoryStats = stats.find(s => s.category.id === category.id)
                  const isActive = activeTab === category.id
                  return (
                    <div
                      key={category.id}
                      className={cn(
                        "p-3 rounded border cursor-pointer group relative overflow-hidden transition-colors",
                        isActive 
                          ? "border-primary/30 bg-white/5" 
                          : "border-transparent hover:border-border-dark hover:bg-white/5"
                      )}
                      onClick={() => setActiveTab(category.id)}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"></div>
                      )}
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-xs font-semibold text-text-primary-dark truncate">
                            {category.name}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-surface-dark border-border-dark">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditCategory(category)
                                }}
                                className="text-text-primary-dark hover:bg-white/10"
                              >
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCategoryClick(category.id)
                                }}
                                className="text-text-primary-dark hover:bg-red-500/20 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {categoryStats && (
                        <div className="flex justify-between items-center text-[10px] text-text-secondary-dark font-mono-numbers">
                          <span>{categoryStats.enabled}/{categoryStats.total} enabled</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Features Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
          {activeCategory ? (
            <>
              <Card className="bg-surface-dark border border-border-dark rounded p-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: activeCategory.color }}
                      />
                      <h2 className="text-sm font-semibold text-text-primary-dark">{activeCategory.name}</h2>
                    </div>
                    {activeCategory.description && (
                      <p className="text-xs text-text-secondary-dark">{activeCategory.description}</p>
                    )}
                  </div>
                  {canCreate && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="bg-surface-dark border-border-dark text-text-primary-dark hover:bg-white/5"
                      onClick={() => {
                        resetForm()
                        setEditingFeature(null)
                        setFormData(prev => ({ ...prev, category_id: activeTab }))
                        setAddDialogOpen(true)
                      }}
                    >
                      <CirclePlus className="h-4 w-4 mr-1.5" />
                      Add Feature
                    </Button>
                  )}
                </div>
              </Card>

              <Card className="flex-1 bg-surface-dark border border-border-dark rounded overflow-hidden flex flex-col min-h-0">
                <div className="p-3 border-b border-border-dark bg-white/5">
                  <span className="text-[10px] uppercase font-bold text-text-secondary-dark tracking-widest">
                    Features ({filteredFeatures.length})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredFeatures.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary-dark text-xs">
                      No features found
                    </div>
                  ) : (
                    filteredFeatures.map((feature) => (
                      <Card 
                        key={feature.id} 
                        className="p-3 bg-background-dark border border-border-dark rounded hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-text-primary-dark">{feature.name}</h3>
                              <Badge 
                                className={cn(
                                  "text-[9px] px-1.5 py-px rounded-full font-mono-numbers",
                                  feature.status === 'online' 
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : feature.status === 'offline'
                                    ? "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                                    : "bg-red-500/10 text-red-500 border border-red-500/20"
                                )}
                              >
                                {feature.status?.toUpperCase() || 'OFFLINE'}
                              </Badge>
                            </div>
                            {feature.description && (
                              <p className="text-xs text-text-secondary-dark mb-2">{feature.description}</p>
                            )}
                            {feature.usage_count !== undefined && (
                              <div className="text-[10px] text-text-secondary-dark font-mono-numbers">
                                Used {feature.usage_count} times
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {canToggle && (
                              <div className="flex items-center gap-2">
                                <Label 
                                  htmlFor={`toggle-${feature.id}`}
                                  className="text-xs text-text-secondary-dark cursor-pointer"
                                >
                                  {feature.enabled ? 'Enabled' : 'Disabled'}
                                </Label>
                                <Switch
                                  id={`toggle-${feature.id}`}
                                  checked={feature.enabled}
                                  onCheckedChange={() => handleFeatureToggle(feature.id)}
                                  disabled={!canToggle}
                                />
                              </div>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
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
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex-1 bg-surface-dark border border-border-dark rounded flex items-center justify-center">
              <div className="text-center text-text-secondary-dark">
                <p className="text-sm mb-2">Select a category to view features</p>
                {categories.length === 0 && canCreate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      resetCategoryForm()
                      setEditingCategory(null)
                      setCategoryDialogOpen(true)
                    }}
                  >
                    <CirclePlus className="h-4 w-4 mr-1.5" />
                    Create First Category
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
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
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark">
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              {editingFeature ? 'Update feature details' : 'Create a new remote control feature'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feature-name" className="text-text-primary-dark">Name</Label>
              <Input
                id="feature-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark mt-1"
                placeholder="Feature name"
              />
            </div>
            <div>
              <Label htmlFor="feature-description" className="text-text-primary-dark">Description</Label>
              <Textarea
                id="feature-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark mt-1"
                placeholder="Feature description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="feature-category" className="text-text-primary-dark">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger className="bg-background-dark border-border-dark text-text-primary-dark mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-surface-dark border-border-dark">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
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
              <Label htmlFor="feature-enabled" className="text-text-primary-dark cursor-pointer">
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
              className="bg-background-dark border-border-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={editingFeature ? handleUpdateFeature : handleAddFeature}
              className="bg-primary hover:bg-primary-hover"
            >
              {editingFeature ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              {editingCategory ? 'Update category details' : 'Create a new category for features'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name" className="text-text-primary-dark">Name</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark mt-1"
                placeholder="Category name"
              />
            </div>
            <div>
              <Label htmlFor="category-description" className="text-text-primary-dark">Description</Label>
              <Textarea
                id="category-description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-background-dark border-border-dark text-text-primary-dark mt-1"
                placeholder="Category description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category-color" className="text-text-primary-dark">Color</Label>
              <div className="flex items-center gap-2 mt-1">
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
              className="bg-background-dark border-border-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
              className="bg-primary hover:bg-primary-hover"
            >
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Feature Confirmation Dialog */}
      <Dialog open={deleteFeatureDialogOpen} onOpenChange={setDeleteFeatureDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark">
          <DialogHeader>
            <DialogTitle>Delete Feature</DialogTitle>
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
              className="bg-background-dark border-border-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteFeatureConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      <Dialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
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
              className="bg-background-dark border-border-dark"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCategoryConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

