"use client"

import React, { useState, useEffect } from 'react'
import { 
  Eye, 
  Settings, 
  Monitor,
  Box,
  Loader2,
  Plus,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

// UI Components
import { Card, CardContent, CardTitle, CardHeader, CardFooter, CardDescription, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

// Hooks & Types
import { useProductQuery } from '@/features/product-management/hooks/use-product-query'
import type { Product } from '@/entities/product'
import { EmptyState, AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'

// --- Types ---

interface FeatureGroup {
  id: string
  title: string
  icon: React.ReactNode
  features: Feature[]
}

interface Feature {
  id: string
  label: string
  type: 'toggle' | 'slider' | 'int-slider' | 'float-slider' | 'select'
  value: boolean | number | string
  min?: number
  max?: number
  options?: string[]
}

const INITIAL_FEATURES: FeatureGroup[] = [
  {
    id: 'visuals',
    title: 'Visual Assistance',
    icon: <Eye className="size-3" />,
    features: [
      { id: 'esp_master', label: 'Master Switch', type: 'toggle', value: true },
      { id: 'esp_box', label: 'Box Type', type: 'select', value: '2D Corners', options: ['2D Full', '2D Corners', '3D Box'] },
      { id: 'esp_skeleton', label: 'Skeleton Overlay', type: 'toggle', value: true },
      { id: 'esp_dist', label: 'Render Distance', type: 'int-slider', value: 500, min: 100, max: 2000 },
    ]
  },
  {
    id: 'misc',
    title: 'System & Misc',
    icon: <Settings className="size-3" />,
    features: [
      { id: 'radar_2d', label: 'Radar 2D', type: 'toggle', value: true },
      { id: 'panic_key', label: 'Panic Key', type: 'select', value: 'F12', options: ['F12', 'DEL', 'INS'] },
      { id: 'stream_proof', label: 'Stream Proof', type: 'toggle', value: true },
    ]
  }
]

export function RemoteControlPage() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { products, loading: productsLoading, error: productsError } = useProductQuery()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [features, setFeatures] = useState<FeatureGroup[]>(INITIAL_FEATURES)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Set first product as selected when products are loaded
  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0])
    }
  }, [products, selectedProduct])

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

  const handleFeatureChange = (groupId: string, featureId: string, newValue: any) => {
    setFeatures(prev => prev.map(group => {
      if (group.id !== groupId) return group
      return {
        ...group,
        features: group.features.map(f => {
          if (f.id === featureId) return { ...f, value: newValue }
          return f
        })
      }
    }))
  }

  const handleCreateCategory = () => {
    if (!categoryName.trim()) return
    
    const newCategory: FeatureGroup = {
      id: `category_${Date.now()}`,
      title: categoryName,
      icon: <Settings className="size-3" />,
      features: []
    }
    
    setFeatures(prev => [...prev, newCategory])
    setCategoryDialogOpen(false)
    setCategoryName('')
    setCategoryDescription('')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // TODO: Add actual refresh logic here (e.g., refetch products, features)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 500))
    setRefreshing(false)
  }
  
  // Calculate category and online features stats
  const totalCategories = features.length
  const onlineFeatures = features.reduce((count, group) => {
    return count + group.features.filter(f => f.type === 'toggle' && f.value === true).length
  }, 0)

  // Show empty state if no products and not loading
  if (!productsLoading && !productsError && products.length === 0) {
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
      title: 'Online Features',
      value: onlineFeatures,
      icon: Monitor,
      subtitle: `${onlineFeatures} enabled`,
      badge: {
        text: `${onlineFeatures} enabled`,
        color: 'primary'
      },
      description: 'Currently enabled features'
    }
  ]

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
                            value={selectedProduct?.id?.toString() || ''}
                            onValueChange={(value) => {
                                const product = products.find(p => p.id.toString() === value)
                                setSelectedProduct(product || null)
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
                                    <span className="text-[10px] text-muted-foreground">Online:</span>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                                        {onlineFeatures}
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
                        disabled={refreshing}
                        className="h-7 w-7"
                    >
                        {refreshing ? (
                            <Spinner className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs px-2.5 gap-1.5 bg-background hover:bg-muted/50"
                        onClick={() => setCategoryDialogOpen(true)}
                    >
                        <Plus className="size-3" /> Create Category
                    </Button>
                </div>
            </div>

            {/* Features Grid */}
            {selectedProduct ? (
              totalCategories === 0 ? (
                <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                  <EmptyState
                    title="No categories available"
                    description="Create categories and add features to start using remote control."
                    icon={Settings}
                    iconStyle="rounded"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-auto bg-muted/5">
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {features.map(group => (
                          <Card key={group.id} className="p-0 border rounded-lg bg-background shadow-sm h-fit">
                              <div className="px-3 py-2.5 border-b bg-muted/30">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                          <div className="text-muted-foreground bg-muted/20 p-1 rounded-sm border">
                                              {group.icon}
                                          </div>
                                          <CardTitle className="text-xs font-semibold">{group.title}</CardTitle>
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground opacity-50">
                                          GRP_ID: {group.id.toUpperCase()}
                                      </span>
                                  </div>
                              </div>
                              <CardContent className="p-2">
                                  <div className="space-y-0.5">
                                      {group.features.map((feature) => (
                                          <div key={feature.id} className="flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 rounded-md transition-colors group">
                                              <div className="flex flex-col gap-0.5 max-w-[50%]">
                                                  <Label htmlFor={feature.id} className="text-xs font-medium cursor-pointer truncate">
                                                      {feature.label}
                                                  </Label>
                                                  <span className="text-[10px] text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity font-mono">
                                                      {feature.id}
                                                  </span>
                                              </div>

                                              <div className="flex items-center justify-end w-[45%]">
                                                  {feature.type === 'toggle' && (
                                                      <Switch 
                                                          id={feature.id}
                                                          checked={feature.value as boolean} 
                                                          onCheckedChange={(val) => handleFeatureChange(group.id, feature.id, val)}
                                                          className="scale-75 origin-right data-[state=checked]:bg-primary" 
                                                      />
                                                  )}
                                                  
                                                  {(feature.type === 'slider' || feature.type === 'int-slider' || feature.type === 'float-slider') && (
                                                      <div className="flex items-center gap-2 w-full pl-2">
                                                          <Slider 
                                                              value={[feature.value as number]} 
                                                              min={feature.min} 
                                                              max={feature.max}
                                                              step={feature.type === 'int-slider' ? 1 : feature.type === 'float-slider' ? 0.1 : 10}
                                                              onValueChange={(vals) => handleFeatureChange(group.id, feature.id, vals[0])}
                                                              className="flex-1"
                                                          />
                                                          <span className="text-[10px] font-mono text-muted-foreground min-w-[30px] text-right">
                                                              {feature.type === 'float-slider' ? (feature.value as number).toFixed(1) : feature.value}
                                                          </span>
                                                      </div>
                                                  )}

                                                  {feature.type === 'select' && feature.options && (
                                                      <Select 
                                                          value={feature.value as string}
                                                          onValueChange={(val) => handleFeatureChange(group.id, feature.id, val)}
                                                      >
                                                          <SelectTrigger className="w-full h-7 text-[10px] bg-muted/30 border-muted-foreground/20 focus:ring-0">
                                                              <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                              {feature.options.map(opt => (
                                                                  <SelectItem key={opt} value={opt} className="text-xs">
                                                                      {opt}
                                                                  </SelectItem>
                                                              ))}
                                                          </SelectContent>
                                                      </Select>
                                                  )}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </CardContent>
                          </Card>
                        ))}
                    </div>
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

      {/* Create Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Create a new category to organize remote control features.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="Enter category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-description">Description (Optional)</Label>
              <Textarea
                id="category-description"
                placeholder="Enter category description"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryDialogOpen(false)
                setCategoryName('')
                setCategoryDescription('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={!categoryName.trim()}>
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 