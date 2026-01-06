import React from 'react'
import { Settings, Monitor, Box, Eye, Gauge, Plus } from 'lucide-react'
import { useRemoteControlLogic } from '../hooks/use-remote-control-logic'
import { EmptyState, AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'
import { CategoryDialog, CategoryTabs } from '../category'
import { FeatureDialog } from './FeatureDialog'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import type { RemoteCategory } from '../category'
import type { RemoteFeature } from '@/shared/lib/remote-control-api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils.ts'

interface FeatureGroup {
  id: string
  title: string
  icon: string
  color: string
  features: RemoteFeature[]
}

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
    loading,
    error,
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingCategory,
    categoryFormData,
    setCategoryFormData,
    addDialogOpen,
    setAddDialogOpen,
    editingFeature,
    formData,
    setFormData,
    handleProductChange,
    handleFeatureToggle,
    handleSliderValueChange,
    handleAddFeature,
    handleUpdateFeature,
    handleAddCategory,
    handleEditCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    resetForm,
    resetCategoryForm,
    getCategoryFeatures,
    canToggle
  } = useRemoteControlLogic()

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
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

  if (!productsLoading && products.length === 0) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <EmptyState
          title="No products available"
          description="Create your first product to start using remote control features."
          icon={Box}
        />
      </div>
    )
  }

  // Transform categories
  const featureGroups: FeatureGroup[] = categories.map(category => ({
    id: category.id,
    title: category.name,
    icon: 'settings',
    color: category.color,
    features: getCategoryFeatures(category.id)
  }))

  const categoryCount = categories.length
  const totalFunctions = features.length
  const activeFunctions = features.filter(f => f.enabled).length

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'settings': return Settings
      case 'monitor': return Monitor
      case 'eye': return Eye
      case 'gauge': return Gauge
      default: return Settings
    }
  }

  const statCards = [
    {
      title: 'Categories',
      value: categoryCount,
      icon: Settings,
      subtitle: `${categoryCount} groups`,
      description: 'Feature categories',
      badge: {
        text: 'Groups',
        color: 'primary'
      }
    },
    {
      title: 'Active Features',
      value: activeFunctions,
      icon: Monitor,
      subtitle: `${activeFunctions}/${totalFunctions} active`,
      description: 'Enabled features',
      badge: {
        text: 'Active',
        color: 'primary'
      }
    },
    {
      title: 'Total Features',
      value: totalFunctions,
      icon: Gauge,
      subtitle: `${totalFunctions} total`,
      description: 'Available features',
      badge: {
        text: 'Total',
        color: 'primary'
      }
    }
  ]

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  Remote Control
                </h1>
                <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                  Manage remote control features and configure product settings
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-6">
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 min-h-0 items-start">
              {/* Sidebar: Products List */}
              <div className="flex flex-col h-[calc(100vh-12rem)] md:sticky md:top-4 border rounded-lg bg-background shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 border-b bg-muted/30">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Products ({products.length})
              </div>
            </div>
            
            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="size-4" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                    No products available
                  </div>
                ) : (
                  products.map(product => {
                    const isSelected = selectedProductId === product.id
                    return (
                      <Button
                        key={product.id}
                        variant={isSelected ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleProductChange(product.id)}
                        className={cn(
                          "w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md",
                          isSelected 
                            ? "bg-secondary font-medium shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Box className={cn(
                          "size-3.5 mr-2",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )} />
                        <span className="truncate">{product.name}</span>
                      </Button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
              </div>

              {/* Main Panel */}
              <div className="flex flex-col gap-3 min-w-0">
                {/* Top Stats Cards */}
                <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 sm:grid-cols-3 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
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

                {/* Content Area */}
                {selectedProductId ? (
                  loading ? (
                    <div className="min-h-[200px] flex items-center justify-center -mx-4 md:-mx-6 px-4 md:px-6">
                      <Spinner className="size-6" />
                    </div>
                  ) : error ? (
                    <div className="flex justify-center -mx-4 md:-mx-6 px-4 md:px-6 py-8">
                      <EmptyState title="Error" description={error} icon={Settings} />
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="flex justify-center -mx-4 md:-mx-6 px-4 md:px-6 py-12">
                      <EmptyState
                        title="No categories"
                        description="Create categories to start."
                        icon={Settings}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 -mx-4 md:-mx-6 px-4 md:px-6">
                      {/* Tabs */}
                      <div className="relative">
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

                      {/* Feature Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {featureGroups
                      .filter(group => group.id === activeTab || !activeTab)
                      .map(group => {
                        const Icon = getIcon(group.icon)
                        return (
                          <Card key={group.id} className="p-3 border rounded-lg bg-background shadow-sm">
                            <CardHeader className="p-0 pb-1">
                              <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-xs font-semibold">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  <span className="truncate">{group.title}</span>
                                </CardTitle>
                                <Icon className="size-3 text-muted-foreground opacity-50 shrink-0" />
                              </div>
                            </CardHeader>
                            
                            <CardContent className="p-0 pt-1">
                              {group.features.length === 0 ? (
                                <div className="p-2 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                                  No features in this category
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {group.features.map((feature) => {
                                    const config = feature.configuration || {}
                                    const featureType = config.type || 'toggle'
                                    
                                    return (
                                      <div 
                                        key={feature.id} 
                                        className={cn(
                                          "flex items-center justify-between p-2 transition-colors rounded-md",
                                          "hover:bg-muted/50"
                                        )}
                                      >
                                        <div className="flex flex-col min-w-0 pr-3">
                                          <span className="text-xs font-medium text-foreground truncate">
                                            {feature.name}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground font-mono opacity-70 mt-0.5">
                                            ID: {feature.id}
                                          </span>
                                        </div>
                                        
                                        <div className="shrink-0 flex items-center gap-2">
                                          {featureType === 'toggle' && (
                                            <Switch
                                              checked={feature.enabled}
                                              onCheckedChange={() => handleFeatureToggle(feature.id)}
                                              disabled={!canToggle}
                                              className="scale-90 origin-right"
                                            />
                                          )}
                                          
                                          {(featureType === 'slider' || featureType === 'int-slider' || featureType === 'float-slider') && (() => {
                                            const min = config.min ?? 0
                                            const max = config.max ?? 100
                                            const currentValue = typeof config.default === 'number' ? config.default : min
                                            const isOnOffMode = min === 0 && max === 1
                                            
                                            return (
                                              <div className="flex items-center gap-2 w-28 xs:w-32">
                                                <Slider
                                                  value={[currentValue]}
                                                  min={min}
                                                  max={max}
                                                  step={isOnOffMode ? 1 : (config.step || (featureType === 'int-slider' ? 1 : 0.1))}
                                                  disabled={!canToggle}
                                                  className="flex-1"
                                                  onValueChange={(values) => {
                                                    let newValue = values[0]
                                                    // For on/off mode, snap to 0 or 1
                                                    if (isOnOffMode) {
                                                      newValue = newValue >= 0.5 ? 1 : 0
                                                    }
                                                    handleSliderValueChange(feature.id, newValue)
                                                  }}
                                                />
                                                <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                                                  {isOnOffMode 
                                                    ? (currentValue >= 0.5 ? 'On' : 'Off')
                                                    : (featureType === 'float-slider' ? currentValue.toFixed(1) : Math.round(currentValue))
                                                  }
                                                </span>
                                              </div>
                                            )
                                          })()}

                                          {featureType === 'select' && config.options && (
                                            <Select
                                              value={String(config.default || config.options[0])}
                                              disabled={!canToggle}
                                            >
                                              <SelectTrigger className="w-[110px] h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="text-xs">
                                                {config.options.map((opt: string) => (
                                                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                                                    {opt}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              
                              {/* Add Feature Button */}
                              <ConditionalRender permission="remote_control.create" fallback={null}>
                                <div className="pt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      resetForm()
                                      setFormData((prev) => ({ ...prev, category_id: group.id }))
                                      setAddDialogOpen(true)
                                    }}
                                    className="w-full h-8 text-xs gap-2"
                                  >
                                    <Plus className="size-3" />
                                    Add Feature
                                  </Button>
                                </div>
                              </ConditionalRender>
                            </CardContent>
                          </Card>
                        )
                      })}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex items-center justify-center -mx-4 md:-mx-6 px-4 md:px-6 py-12">
                    <Card className="w-full max-w-md border-dashed">
                      <div className="p-8 flex flex-col items-center justify-center">
                        <EmptyState
                          title="No product selected"
                          description="Select a product from the sidebar to configure."
                          icon={Box}
                        />
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
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

      <FeatureDialog
        featureDialogOpen={addDialogOpen}
        setFeatureDialogOpen={setAddDialogOpen}
        editingFeature={editingFeature}
        categories={categories}
        featureFormData={formData}
        setFeatureFormData={setFormData}
        onAddFeature={handleAddFeature}
        onUpdateFeature={handleUpdateFeature}
        onResetFeatureForm={resetForm}
        categoryId={editingFeature ? editingFeature.category : formData.category_id}
      />
    </div>
  )
}