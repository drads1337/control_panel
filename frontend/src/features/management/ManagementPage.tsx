import React, { useState, useMemo } from 'react'
import { Key, Package, Folder, Zap, FolderOpen, CirclePlus, FileEdit, Plus, Layers, Settings } from 'lucide-react'
import { Button } from '@/shared/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Input } from '@/shared/ui/components/input'
import { Label } from '@/shared/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select'
import { Separator } from '@/shared/ui/components/separator'
import { LicenseKeysTable } from '@/features/license-keys/components'
import { FileManager } from '@/features/file-manager'
import { ProductsManager } from '@/features/products/components'
import { AgentsManager } from '@/features/agent-management/components'
import { useProductsQuery } from '@/features/product-database/hooks/use-products-query'
import { useAgentsQuery } from '@/entities/agent/model/queries'
import { useKeysQuery } from '@/entities/key/model/queries'
import { createAgentKey, createCustomAgentKey, bulkCreateAgentKeys } from '@/entities/key'
import { 
  bulkPauseKeys, 
  bulkActivateKeys, 
  bulkDeleteKeys, 
  bulkAddHoursToKeys,
  bulkPauseAgentKeys,
  bulkActivateAgentKeys,
  bulkDeleteAgentKeys,
  bulkAddHoursToAgentKeys
} from '@/entities/key/api/bulk'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keyKeys } from '@/entities/key/model/queries'
import type { Product } from '@/entities/product'

export function ManagementPage() {
  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('license-keys')

  // Create License Key form state
  const [target, setTarget] = useState<'product' | 'agent'>('product')
  const [durationPreset, setDurationPreset] = useState<string | null>('1M')
  const [product, setProduct] = useState<string>('')
  const [customHours, setCustomHours] = useState<string>('')
  const [maxDevices, setMaxDevices] = useState<string>('1')

  // Create Custom Key form state
  const [customTarget, setCustomTarget] = useState<'product' | 'agent'>('product')
  const [customKeyProduct, setCustomKeyProduct] = useState<string>('')
  const [customDurationPreset, setCustomDurationPreset] = useState<string | null>(null)
  const [keyName, setKeyName] = useState<string>('')
  const [customKeyHours, setCustomKeyHours] = useState<string>('')
  const [customKeyMaxDevices, setCustomKeyMaxDevices] = useState<string>('1')

  // Bulk Create Key form state
  const [bulkCreateTarget, setBulkCreateTarget] = useState<'product' | 'agent'>('product')
  const [bulkCreateProduct, setBulkCreateProduct] = useState<string>('')
  const [bulkCreateCount, setBulkCreateCount] = useState<string>('1')
  const [bulkCreateDurationPreset, setBulkCreateDurationPreset] = useState<string | null>('1M')
  const [bulkCreateHours, setBulkCreateHours] = useState<string>('')
  const [bulkCreateMaxDevices, setBulkCreateMaxDevices] = useState<string>('1')

  // Bulk Operation form state
  const [bulkOperationTarget, setBulkOperationTarget] = useState<'product' | 'agent'>('product')
  const [bulkOperationProduct, setBulkOperationProduct] = useState<string>('')
  const [bulkOperationAction, setBulkOperationAction] = useState<string>('delete')
  const [bulkOperationKeyIds, setBulkOperationKeyIds] = useState<string>('')
  const [bulkOperationHours, setBulkOperationHours] = useState<string>('')

  // Data hooks
  const { products, loading: productsLoading } = useProductsQuery('all')
  const { agents, loading: agentsLoading } = useAgentsQuery()
  const { createKey, createCustomKey, bulkCreateKeys } = useKeysQuery({ enabled: false })
  const queryClient = useQueryClient()

  // Duration conversion function
  const convertDurationToHours = (preset: string | null): number => {
    if (!preset) return 24
    const durationMap: Record<string, number> = {
      '1H': 1,
      '6H': 6,
      '12H': 12,
      '1D': 24,
      '3D': 72,
      '1W': 168,
      '2W': 336,
      '1M': 720,
      '2M': 1440,
      '3M': 2160,
      '6M': 4320,
      '1Y': 8760
    }
    return durationMap[preset] || 24
  }

  // Get duration hours helper
  const getDurationHours = (preset: string | null, customHours: string): number => {
    if (customHours && customHours.trim() !== '') {
      const parsed = parseInt(customHours)
      return isNaN(parsed) ? 24 : parsed
    }
    return convertDurationToHours(preset)
  }

  // Mutations for agent keys
  const createAgentKeyMutation = useMutation({
    mutationFn: createAgentKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Agent key created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create agent key')
    },
  })

  const createCustomAgentKeyMutation = useMutation({
    mutationFn: createCustomAgentKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Custom agent key created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create custom agent key')
    },
  })

  const bulkCreateAgentKeysMutation = useMutation({
    mutationFn: bulkCreateAgentKeys,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Agent keys created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create agent keys')
    },
  })

  // Bulk operations mutations
  const bulkOperationMutation = useMutation({
    mutationFn: async ({ action, target, productId, agentId, productIds, keyIds, hours }: any) => {
      if (target === 'product') {
        switch (action) {
          case 'delete':
            return bulkDeleteKeys(Number(productId))
          case 'pause':
            return bulkPauseKeys(Number(productId))
          case 'activate':
          case 'resume':
            return bulkActivateKeys(Number(productId))
          case 'add_hours':
            return bulkAddHoursToKeys(Number(productId), Number(hours))
          default:
            throw new Error('Invalid action')
        }
      } else {
        if (!agentId || !productIds || productIds.length === 0) {
          throw new Error('Agent ID and product IDs are required')
        }
        switch (action) {
          case 'delete':
            return bulkDeleteAgentKeys(Number(agentId), productIds.map(Number))
          case 'pause':
            return bulkPauseAgentKeys(Number(agentId), productIds.map(Number))
          case 'activate':
          case 'resume':
            return bulkActivateAgentKeys(Number(agentId), productIds.map(Number))
          case 'add_hours':
            return bulkAddHoursToAgentKeys(Number(agentId), productIds.map(Number), Number(hours))
          default:
            throw new Error('Invalid action')
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Bulk operation completed successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to perform bulk operation')
    },
  })

  // Handlers
  const handleCreateKey = async () => {
    if (!product) {
      toast.error('Please select a product')
      return
    }

    const durationHours = getDurationHours(durationPreset, customHours)
    const maxDevicesNum = parseInt(maxDevices) || 1

    if (target === 'product') {
      await createKey({
        product_id: Number(product),
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
      })
    } else {
      // For agent keys, we need agent_id and product_ids
      // For now, we'll use the first agent if available
      if (agents.length === 0) {
        toast.error('No agents available')
        return
      }
      await createAgentKeyMutation.mutateAsync({
        agent_id: agents[0].id,
        product_ids: [Number(product)],
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
      })
    }
  }

  const handleCreateCustomKey = async () => {
    if (!customKeyProduct || !keyName) {
      toast.error('Please select a product and enter a key name')
      return
    }

    const durationHours = getDurationHours(customDurationPreset, customKeyHours)
    const maxDevicesNum = parseInt(customKeyMaxDevices) || 1

    if (customTarget === 'product') {
      await createCustomKey({
        product_id: Number(customKeyProduct),
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
        custom_key: keyName,
      })
    } else {
      if (agents.length === 0) {
        toast.error('No agents available')
        return
      }
      await createCustomAgentKeyMutation.mutateAsync({
        agent_id: agents[0].id,
        product_ids: [Number(customKeyProduct)],
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
        custom_key: keyName,
      })
    }
  }

  const handleBulkCreateKeys = async () => {
    if (!bulkCreateProduct) {
      toast.error('Please select a product')
      return
    }

    const count = parseInt(bulkCreateCount) || 1
    const durationHours = getDurationHours(bulkCreateDurationPreset, bulkCreateHours)
    const maxDevicesNum = parseInt(bulkCreateMaxDevices) || 1

    if (bulkCreateTarget === 'product') {
      await bulkCreateKeys({
        count,
        product_id: Number(bulkCreateProduct),
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
      })
    } else {
      if (agents.length === 0) {
        toast.error('No agents available')
        return
      }
      await bulkCreateAgentKeysMutation.mutateAsync({
        count,
        agent_id: agents[0].id,
        product_ids: [Number(bulkCreateProduct)],
        duration_hours: durationHours,
        max_devices: maxDevicesNum,
      })
    }
  }

  const handleBulkOperation = async () => {
    if (!bulkOperationProduct) {
      toast.error('Please select a product')
      return
    }

    const productId = Number(bulkOperationProduct)
    const agentId = bulkOperationTarget === 'agent' && agents.length > 0 ? agents[0].id : null
    const productIds = bulkOperationTarget === 'agent' ? [productId] : null

    if (bulkOperationAction === 'add_hours' && !bulkOperationHours) {
      toast.error('Please enter hours')
      return
    }

    await bulkOperationMutation.mutateAsync({
      action: bulkOperationAction,
      target: bulkOperationTarget,
      productId: bulkOperationTarget === 'product' ? productId : undefined,
      agentId,
      productIds,
      hours: bulkOperationAction === 'add_hours' ? Number(bulkOperationHours) : undefined,
    })
  }

  const durationOptions = ['1H', '6H', '12H', '1D', '3D', '1W', '2W', '1M', '2M', '3M', '6M', '1Y']
  const metricCards = [
    { Icon: Key, title: "License Keys", val: "208", sub: "207 ACTIVE KEYS", label: "Active", accent: "text-primary", borderHover: "group-hover:border-primary/50" },
    { Icon: Package, title: "Products", val: "2", sub: "GLOBAL ITEMS", label: "DB", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" },
    { Icon: Folder, title: "Files", val: "0", sub: "SYSTEM FILES", label: "SYS", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" },
    { Icon: Zap, title: "Agents", val: "0", sub: "ONLINE NODES", label: "NET", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" }
  ]

  const tabs = [
    { id: 'license-keys', label: "License Keys", Icon: Key },
    { id: 'file-manager', label: "File Manager", Icon: FolderOpen },
    { id: 'products', label: "Products", Icon: Package },
    { id: 'agents', label: "Agents", Icon: Zap }
  ]

  return (
    <div className="space-y-5 overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Metric Cards */}
        {metricCards.map((item, i) => (
          <Card key={i} className={`bg-surface-dark border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group ${item.borderHover} transition-colors duration-300`}>
            <div className="flex justify-between items-start z-10">
              <div className="flex items-center gap-2 text-text-secondary-dark text-xs font-semibold uppercase tracking-wider">
                <item.Icon className="h-3.5 w-3.5" />
                {item.title}
              </div>
              <span className={`${item.accent} text-[10px] uppercase font-bold tracking-widest font-mono-numbers opacity-80`}>{item.label}</span>
            </div>
            <div className="z-10 flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark font-mono-numbers tracking-tight">{item.val}</div>
              </div>
              <div className="text-[10px] text-text-secondary-dark mb-1 font-mono-numbers text-right" dangerouslySetInnerHTML={{ __html: item.sub.replace(' ', '<br/>') }} />
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <item.Icon className="h-32 w-32" />
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-surface-dark border border-border-dark rounded p-1 flex items-center overflow-x-auto shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded transition-all uppercase tracking-wide ${
              activeTab === tab.id
                ? "font-bold bg-white/10 text-text-primary-dark border border-border-dark shadow-sm"
                : "font-medium text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5"
            }`}
          >
            <tab.Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'license-keys' && (
        <div className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Create License Key Form */}
        <Card className="bg-surface-dark border-border-dark rounded p-5 relative shadow-sm">
          <CardHeader className="mb-5 pb-3 flex flex-col gap-3 p-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Create License Key
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary-dark mt-1">Generate new access credentials.</CardDescription>
              </div>
              <CirclePlus className="h-5 w-5 text-border-dark" />
            </div>
            <Separator className="border-border-dark" />
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</Label>
                <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                  <Button 
                    size="sm" 
                    onClick={() => setTarget('product')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold shadow-sm rounded-sm h-auto transition-colors ${
                      target === 'product' 
                        ? 'bg-primary text-background-dark' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Product
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setTarget('agent')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-sm h-auto transition-colors ${
                      target === 'agent' 
                        ? 'bg-primary text-background-dark font-semibold shadow-sm' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
                </div>
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</Label>
                <Select value={product} onValueChange={setProduct} disabled={productsLoading}>
                  <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent 
                    className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                    position="popper"
                  >
                    {products.map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Duration Preset</Label>
              <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono-numbers">
                {durationOptions.map((d) => (
                  <Button 
                    key={d} 
                    size="sm"
                    onClick={() => setDurationPreset(d)}
                    variant={durationPreset === d ? "default" : "outline"}
                    className={`${durationPreset === d ? "bg-primary text-background-dark font-bold border-primary" : "bg-background-dark border-border-dark hover:border-primary text-text-secondary-dark"} py-1.5 rounded transition-colors h-auto text-[10px] font-mono-numbers`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Custom Hours</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px]" 
                  placeholder="e.g., 48" 
                  type="text"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                />
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Max Devices</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary font-mono-numbers h-[32px]" 
                  type="number" 
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <div className="mt-6 flex flex-col gap-4">
            <Separator className="border-border-dark" />
            <div className="flex justify-end">
              <Button 
                onClick={handleCreateKey}
                disabled={productsLoading || !product}
                className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="h-3.5 w-3.5" />
                EXECUTE: GENERATE KEY
              </Button>
            </div>
          </div>
        </Card>

        {/* Create Custom Key Form */}
        <Card className="bg-surface-dark border-border-dark rounded p-5 relative shadow-sm opacity-90">
          <CardHeader className="mb-5 pb-3 flex flex-col gap-3 p-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-inactive-dark"></span>
                  Create Custom Key
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary-dark mt-1">Specific naming conventions.</CardDescription>
              </div>
              <FileEdit className="h-5 w-5 text-border-dark" />
            </div>
            <Separator className="border-border-dark" />
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</Label>
                <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                  <Button 
                    size="sm" 
                    onClick={() => setCustomTarget('product')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold shadow-sm rounded-sm h-auto transition-colors ${
                      customTarget === 'product' 
                        ? 'bg-primary text-background-dark' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Product
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setCustomTarget('agent')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-sm h-auto transition-colors ${
                      customTarget === 'agent' 
                        ? 'bg-primary text-background-dark font-semibold shadow-sm' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
                </div>
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</Label>
                <Select value={customKeyProduct} onValueChange={setCustomKeyProduct} disabled={productsLoading}>
                  <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent 
                    className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                    position="popper"
                  >
                    {products.map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Key Name</Label>
              <Input 
                className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark h-[30px]" 
                placeholder="KEY_NAME_001" 
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Duration Preset</Label>
              <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono-numbers">
                {durationOptions.map((d) => (
                  <Button 
                    key={d} 
                    size="sm"
                    onClick={() => setCustomDurationPreset(d)}
                    variant={customDurationPreset === d ? "default" : "outline"}
                    className={`${customDurationPreset === d ? "bg-primary text-background-dark font-bold border-primary" : "bg-background-dark border-border-dark hover:border-primary text-text-secondary-dark"} py-1.5 rounded transition-colors h-auto text-[10px] font-mono-numbers`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Custom Hours</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px]" 
                  placeholder="e.g., 48" 
                  type="text"
                  value={customKeyHours}
                  onChange={(e) => setCustomKeyHours(e.target.value)}
                />
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Max Devices</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary font-mono-numbers h-[32px]" 
                  type="number" 
                  value={customKeyMaxDevices}
                  onChange={(e) => setCustomKeyMaxDevices(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <div className="mt-6 flex flex-col gap-4">
            <Separator className="border-border-dark" />
            <div className="flex justify-end">
              <Button 
                onClick={handleCreateCustomKey}
                disabled={productsLoading || !customKeyProduct || !keyName}
                className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" />
                EXECUTE: CUSTOM KEY
              </Button>
            </div>
          </div>
        </Card>

        {/* Bulk Create Key Form */}
        <Card className="bg-surface-dark border-border-dark rounded p-5 relative shadow-sm">
          <CardHeader className="mb-5 pb-3 flex flex-col gap-3 p-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Bulk Create Key
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary-dark mt-1">Generate multiple keys at once.</CardDescription>
              </div>
              <Layers className="h-5 w-5 text-border-dark" />
            </div>
            <Separator className="border-border-dark" />
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</Label>
                <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                  <Button 
                    size="sm" 
                    onClick={() => setBulkCreateTarget('product')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold shadow-sm rounded-sm h-auto transition-colors ${
                      bulkCreateTarget === 'product' 
                        ? 'bg-primary text-background-dark' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Product
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setBulkCreateTarget('agent')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-sm h-auto transition-colors ${
                      bulkCreateTarget === 'agent' 
                        ? 'bg-primary text-background-dark font-semibold shadow-sm' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
                </div>
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</Label>
                <Select value={bulkCreateProduct} onValueChange={setBulkCreateProduct} disabled={productsLoading}>
                  <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent 
                    className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                    position="popper"
                  >
                    {products.map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Count</Label>
              <Input 
                className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[30px]" 
                placeholder="e.g., 100" 
                type="number"
                min="1"
                max="100"
                value={bulkCreateCount}
                onChange={(e) => setBulkCreateCount(e.target.value)}
              />
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Duration Preset</Label>
              <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono-numbers">
                {durationOptions.map((d) => (
                  <Button 
                    key={d} 
                    size="sm"
                    onClick={() => setBulkCreateDurationPreset(d)}
                    variant={bulkCreateDurationPreset === d ? "default" : "outline"}
                    className={`${bulkCreateDurationPreset === d ? "bg-primary text-background-dark font-bold border-primary" : "bg-background-dark border-border-dark hover:border-primary text-text-secondary-dark"} py-1.5 rounded transition-colors h-auto text-[10px] font-mono-numbers`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Custom Hours</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px]" 
                  placeholder="e.g., 48" 
                  type="text"
                  value={bulkCreateHours}
                  onChange={(e) => setBulkCreateHours(e.target.value)}
                />
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Max Devices</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary font-mono-numbers h-[32px]" 
                  type="number" 
                  value={bulkCreateMaxDevices}
                  onChange={(e) => setBulkCreateMaxDevices(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <div className="mt-6 flex flex-col gap-4">
            <Separator className="border-border-dark" />
            <div className="flex justify-end">
              <Button 
                onClick={handleBulkCreateKeys}
                disabled={productsLoading || !bulkCreateProduct}
                className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Layers className="h-3.5 w-3.5" />
                EXECUTE: BULK CREATE
              </Button>
            </div>
          </div>
        </Card>

        {/* Bulk Operation Form */}
        <Card className="bg-surface-dark border-border-dark rounded p-5 relative shadow-sm">
          <CardHeader className="mb-5 pb-3 flex flex-col gap-3 p-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Bulk Operation
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary-dark mt-1">Perform actions on multiple keys.</CardDescription>
              </div>
              <Settings className="h-5 w-5 text-border-dark" />
            </div>
            <Separator className="border-border-dark" />
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</Label>
                <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                  <Button 
                    size="sm" 
                    onClick={() => setBulkOperationTarget('product')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold shadow-sm rounded-sm h-auto transition-colors ${
                      bulkOperationTarget === 'product' 
                        ? 'bg-primary text-background-dark' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Product
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setBulkOperationTarget('agent')}
                    className={`flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-sm h-auto transition-colors ${
                      bulkOperationTarget === 'agent' 
                        ? 'bg-primary text-background-dark font-semibold shadow-sm' 
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
                </div>
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</Label>
                <Select value={bulkOperationProduct} onValueChange={setBulkOperationProduct} disabled={productsLoading}>
                  <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent 
                    className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                    position="popper"
                  >
                    {products.map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Action</Label>
              <Select value={bulkOperationAction} onValueChange={setBulkOperationAction}>
                <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent 
                  className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)]"
                  position="popper"
                >
                  <SelectItem value="delete" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Delete</SelectItem>
                  <SelectItem value="reset" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Reset</SelectItem>
                  <SelectItem value="pause" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Pause</SelectItem>
                  <SelectItem value="resume" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Resume</SelectItem>
                  <SelectItem value="activate" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Activate</SelectItem>
                  <SelectItem value="add_hours" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Add Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Key IDs</Label>
              <Input 
                className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[30px]" 
                placeholder="e.g., 1,2,3 or 1 2 3" 
                type="text"
                value={bulkOperationKeyIds}
                onChange={(e) => setBulkOperationKeyIds(e.target.value)}
              />
            </div>
            {bulkOperationAction === 'add_hours' && (
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Hours</Label>
                <Input 
                  className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px]" 
                  placeholder="e.g., 24" 
                  type="number"
                  min="1"
                  value={bulkOperationHours}
                  onChange={(e) => setBulkOperationHours(e.target.value)}
                />
              </div>
            )}
          </CardContent>
          <div className="mt-6 flex flex-col gap-4">
            <Separator className="border-border-dark" />
            <div className="flex justify-end">
              <Button 
                onClick={handleBulkOperation}
                disabled={productsLoading || !bulkOperationProduct || (bulkOperationAction === 'add_hours' && !bulkOperationHours)}
                className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="h-3.5 w-3.5" />
                EXECUTE: BULK OPERATION
              </Button>
            </div>
          </div>
        </Card>
      </div>

          {/* License Keys Table */}
          <div className="mt-6">
            <LicenseKeysTable />
          </div>
        </div>
      )}

      {activeTab === 'file-manager' && (
        <div className="mt-4">
          <FileManager />
        </div>
      )}

      {activeTab === 'products' && (
        <div className="mt-4">
          <ProductsManager />
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="mt-4">
          <AgentsManager />
        </div>
      )}
    </div>
  )
}

