"use client"

import React, { useState, useEffect } from 'react'
import { 
  Eye, 
  Settings, 
  Monitor,
  Activity,
  Server,
  Wifi,
  Box,
  Users,
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
import { ScrollArea } from '@/components/ui/scroll-area'
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

interface Session {
  id: string
  user: string
  hwid: string
  ip: string
  region: string
  latency: number
  product: string
  status: 'Online' | 'Idle' | 'Unstable'
  uptime: string
}

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

const SESSIONS: Session[] = [
  { id: 'sess_X92', user: 'phantom_01', hwid: 'HW-8293-AB', ip: '192.168.1.142', region: 'EU-West', latency: 24, product: 'Enterprise Suite v2', status: 'Online', uptime: '2h 14m' },
  { id: 'sess_A04', user: 'admin_dev', hwid: 'HW-1102-CC', ip: '10.0.0.5', region: 'NA-East', latency: 45, product: 'Dev Tools', status: 'Idle', uptime: '45m' },
  { id: 'sess_B77', user: 'guest_user', hwid: 'HW-5592-XY', ip: '172.16.0.22', region: 'Asia-South', latency: 120, product: 'Basic Plan', status: 'Unstable', uptime: '12m' },
  { id: 'sess_C12', user: 'test_pilot', hwid: 'HW-9911-ZZ', ip: '192.168.0.101', region: 'US-West', latency: 18, product: 'Enterprise Suite v2', status: 'Online', uptime: '5h 30m' },
]

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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
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

  // Update selected session when product changes
  useEffect(() => {
    if (selectedProduct) {
      const productSessions = SESSIONS.filter(s => s.product === selectedProduct.name)
      if (productSessions.length > 0) {
        setSelectedSession(productSessions[0])
      } else {
        setSelectedSession(null)
      }
    }
  }, [selectedProduct])

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
    // TODO: Add actual refresh logic here (e.g., refetch products, sessions, features)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 500))
    setRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Online': return 'bg-emerald-500'
        case 'Idle': return 'bg-amber-500'
        case 'Unstable': return 'bg-rose-500'
        default: return 'bg-slate-400'
    }
  }

  const filteredSessions = selectedProduct 
    ? SESSIONS.filter(s => s.product === selectedProduct.name)
    : []

  // Calculate stats
  const totalProducts = products.length
  const totalSessions = SESSIONS.length
  const activeSessions = SESSIONS.filter(s => s.status === 'Online').length
  const averageLatency = Math.round(
    SESSIONS.reduce((sum, s) => sum + s.latency, 0) / SESSIONS.length
  )
  
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
      value: totalProducts,
      icon: Box,
      subtitle: 'Total products available',
      badge: {
        text: 'Products',
        color: 'primary'
      },
      description: 'Products in system'
    },
    {
      title: 'Active Sessions',
      value: activeSessions,
      icon: Activity,
      subtitle: `${activeSessions} online`,
      badge: {
        text: `${activeSessions} online`,
        color: 'primary'
      },
      description: 'Currently active sessions'
    },
    {
      title: 'Total Sessions',
      value: totalSessions,
      icon: Users,
      subtitle: 'All sessions',
      badge: {
        text: 'Sessions',
        color: 'primary'
      },
      description: 'Total sessions in system'
    },
    {
      title: 'Avg Latency',
      value: averageLatency,
      icon: Wifi,
      subtitle: `${averageLatency}ms average`,
      badge: {
        text: `${averageLatency}ms`,
        color: 'primary'
      },
      description: 'Average connection latency'
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
              Configure and control features for active user sessions.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-4 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6">
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[550px]">
        
        {/* --- LEFT COLUMN: Product List --- */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col min-h-[550px] border rounded-lg bg-background shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center justify-start">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Product List
              </h3>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : productsError ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-xs text-destructive">{productsError}</span>
                </div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-xs text-muted-foreground">No products available</span>
                </div>
              ) : (
                <div className="space-y-0.5 mb-3">
                  {products.map((product) => {
                    const isSelected = selectedProduct?.id === product.id
                    return (
                      <Button
                        key={product.id}
                        variant={isSelected ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md",
                          isSelected 
                            ? "bg-secondary font-medium shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <Box className={cn(
                          "size-3.5 mr-2",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )} />
                        <span className="truncate">{product.name}</span>
                      </Button>
                    )
                  })}
                </div>
              )}

              {selectedProduct && filteredSessions.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-0.5">
                    <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Sessions
                    </div>
                    {filteredSessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={cn(
                          "flex flex-col gap-1 w-full text-left px-2.5 py-2 rounded-md transition-all",
                          selectedSession?.id === session.id 
                            ? "bg-secondary text-foreground shadow-sm font-medium" 
                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-medium truncate flex items-center gap-1.5">
                            <Monitor className="size-3.5" />
                            {session.user}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px]">{session.latency}ms</span>
                            <div className={cn("size-1.5 rounded-full", getStatusColor(session.status))} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center w-full text-[10px] text-muted-foreground font-mono pl-4.5">
                          <span>{session.ip}</span>
                          <span>{session.region}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* --- RIGHT COLUMN: Details & Controls --- */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col min-h-[550px] min-w-0 border rounded-lg bg-background shadow-sm overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
                <div className="flex items-center gap-3">
                    {selectedProduct && (
                        <>
                            <h2 className="text-sm font-semibold">{selectedProduct.name}</h2>
                            <Separator orientation="vertical" className="h-6" />
                        </>
                    )}
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
            {selectedSession && !(totalCategories === 0 && onlineFeatures === 0) ? (
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
            ) : (
              <div className="flex-1 overflow-auto bg-muted/5 flex items-center justify-center">
                <EmptyState
                  title="No session selected"
                  description={totalCategories === 0 && onlineFeatures === 0
                    ? "No categories or online features available. Create categories and add features to start using remote control."
                    : selectedProduct 
                      ? filteredSessions.length === 0 
                        ? "No active sessions found for this product. Sessions will appear here when users connect."
                        : "Select a session from the list to view and configure its remote control features."
                      : "Select a product from the list to view available sessions."
                  }
                  icon={Monitor}
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