"use client"

import React from 'react'
import { 
  Settings, 
  Monitor,
  Box,
  Loader2,
  RefreshCw
} from 'lucide-react'

// UI Components
import { Card, CardContent, CardTitle, CardHeader, CardFooter, CardDescription, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent } from '@/components/ui/tabs'

// Hooks & Types
import { useRemoteControlLogic } from '../hooks/use-remote-control-logic'
import { EmptyState, AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'
import { CategoryTabs, CategoryDialog } from '../category'
import type { RemoteCategory } from '../category'

export function RemoteControlPage() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
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
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingCategory,
    categoryFormData,
    setCategoryFormData,
    handleProductChange,
    loadData,
    handleFeatureToggle,
    handleAddCategory,
    handleEditCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    resetCategoryForm,
    getCategoryFeatures,
    canCreate,
    canEdit,
    canDelete,
    canToggle,
    canView
  } = useRemoteControlLogic()

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to access remote control."
        useCard={true}
      />
    )
  }

  const handleRefresh = async () => {
    await loadData()
  }

  // Calculate stats
  const totalCategories = categories.length
  const enabledFeatures = features.filter(f => f.enabled).length
  const totalFeatures = features.length

  // Show empty state if no products and not loading
  if (!productsLoading && products.length === 0) {
    return (
      <EmptyState
        title="No products available"
        description="Create your first product to start using remote control features."
        icon={Box}
      />
    )
  }

  const statCards = [
    {
      title: 'Products',
      value: products.length,
      icon: Box,
      subtitle: 'Total products available',
      badge: {
        text: 'Products',
        color: 'primary'
      },
      description: 'Products in system'
    },
    {
      title: 'Categories',
      value: totalCategories,
      icon: Settings,
      subtitle: `${totalCategories} categories`,
      badge: {
        text: `${totalCategories} categories`,
        color: 'primary'
      },
      description: 'Total categories configured'
    },
    {
      title: 'Enabled Features',
      value: enabledFeatures,
      icon: Monitor,
      subtitle: `${enabledFeatures} enabled`,
      badge: {
        text: `${enabledFeatures} enabled`,
        color: 'primary'
      },
      description: 'Currently enabled features'
    }
  ]

  const selectedProduct = products.find(p => p.id === selectedProductId)

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
              Remote Control
            </h1>
            <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Configure and control features for your products.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-3 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon
              return (
                <Card key={index} className="@container/card p-3">
                  <CardHeader className="p-0 pb-1">
                    <CardDescription className="text-xs">{stat.title}</CardDescription>
                    <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                      {stat.value}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        <Icon className="size-3" />
                        {stat.badge.text}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                    <div className="line-clamp-1 flex gap-1.5 font-medium">
                      {stat.subtitle}{" "}
                      <Icon className="size-3" />
                    </div>
                    <div className="text-muted-foreground">
                      {stat.description}
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>

          <div className="px-4 lg:px-6">
            <div className="flex flex-col min-h-[550px]">
              {/* --- MAIN COLUMN: Categories & Features --- */}
              <div className="flex flex-col min-h-[550px] min-w-0 border rounded-lg bg-background shadow-sm overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Select
                        value={selectedProductId?.toString() || ''}
                        onValueChange={(value) => {
                          handleProductChange(parseInt(value))
                        }}
                      >
                        <SelectTrigger className="w-[200px] h-7 text-xs bg-background border-muted-foreground/20">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsLoading ? (
                            <div className="flex items-center justify-center py-2">
                              <Loader2 className="size-3 animate-spin text-muted-foreground" />
                            </div>
                          ) : products.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No products available</div>
                          ) : (
                            products.map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()} className="text-xs">
                                {product.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProduct && (
                      <>
                        <Separator orientation="vertical" className="h-6" />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Categories:</span>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                              {totalCategories}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Enabled:</span>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                              {enabledFeatures}
                            </Badge>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleRefresh}
                      disabled={loading}
                      className="h-7 w-7"
                    >
                      {loading ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    {canCreate && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs px-2.5 gap-1.5 bg-background hover:bg-muted/50"
                        onClick={() => {
                          resetCategoryForm()
                          setCategoryDialogOpen(true)
                        }}
                      >
                        Create Category
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {selectedProductId ? (
                  loading ? (
                    <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                      <EmptyState
                        title="Error loading data"
                        description={error}
                        icon={Settings}
                        iconStyle="rounded"
                      />
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                      <EmptyState
                        title="No categories available"
                        description="Create categories and add features to start using remote control."
                        icon={Settings}
                        iconStyle="rounded"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto bg-muted/5 flex flex-col">
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                        {/* Category Tabs */}
                        <div className="p-4 pb-2 shrink-0">
                          <CategoryTabs
                            categories={categories}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            onAddCategory={() => {
                              resetCategoryForm()
                              setCategoryDialogOpen(true)
                            }}
                            onManageCategories={() => {
                              resetCategoryForm()
                              setCategoryDialogOpen(true)
                            }}
                          />
                        </div>

                        {/* Features Content */}
                        <div className="flex-1 p-4 pt-2 min-h-0">
                          {categories.map(category => {
                            const categoryFeatures = getCategoryFeatures(category.id)
                            return (
                              <TabsContent key={category.id} value={category.id} className="mt-0">
                                {categoryFeatures.length === 0 ? (
                                  <div className="flex items-center justify-center py-12">
                                    <EmptyState
                                      title="No features in this category"
                                      description="Add features to this category to start controlling them remotely."
                                      icon={Settings}
                                      iconStyle="rounded"
                                    />
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <Card className="p-0 border rounded-lg bg-background shadow-sm h-fit">
                                      <div className="px-3 py-2.5 border-b bg-muted/30">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full"
                                              style={{ backgroundColor: category.color }}
                                            />
                                            <CardTitle className="text-xs font-semibold">{category.name}</CardTitle>
                                          </div>
                                          <span className="text-[10px] font-mono text-muted-foreground opacity-50">
                                            {categoryFeatures.length} features
                                          </span>
                                        </div>
                                      </div>
                                      <CardContent className="p-2">
                                        <div className="space-y-0.5">
                                          {categoryFeatures.map((feature) => (
                                            <div key={feature.id} className="flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 rounded-md transition-colors group">
                                              <div className="flex flex-col gap-0.5 max-w-[50%]">
                                                <Label htmlFor={feature.id} className="text-xs font-medium cursor-pointer truncate">
                                                  {feature.name}
                                                </Label>
                                                <span className="text-[10px] text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity font-mono">
                                                  {feature.id}
                                                </span>
                                              </div>

                                              <div className="flex items-center justify-end w-[45%]">
                                                {canToggle && (
                                                  <Switch 
                                                    id={feature.id}
                                                    checked={feature.enabled} 
                                                    onCheckedChange={() => handleFeatureToggle(feature.id)}
                                                    className="scale-75 origin-right data-[state=checked]:bg-primary" 
                                                    disabled={!canToggle}
                                                  />
                                                )}
                                                {!canToggle && (
                                                  <Badge variant={feature.enabled ? "default" : "secondary"} className="text-[10px]">
                                                    {feature.enabled ? "Enabled" : "Disabled"}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </TabsContent>
                            )
                          })}
                        </div>
                      </Tabs>
                    </div>
                  )
                ) : (
                  <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                    <EmptyState
                      title="No product selected"
                      description="Select a product from the list to configure its remote control features."
                      icon={Box}
                      iconStyle="rounded"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Dialog */}
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
    </div>
  )
}
