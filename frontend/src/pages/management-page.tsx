import React, { useState } from 'react'
import { Key, Package, Folder, Zap, FolderOpen, CirclePlus, FileEdit, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Input } from '@/shared/ui/components/input'
import { Label } from '@/shared/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/components/tabs'
import { Separator } from '@/shared/ui/components/separator'
import { LicenseKeysTable } from '@/features/license-keys/components'
import { FileManager } from '@/features/file-manager'

export function ManagementPage() {
  // Create License Key form state
  const [target, setTarget] = useState<'product' | 'agent'>('product')
  const [durationPreset, setDurationPreset] = useState<string | null>('1M')
  const [product, setProduct] = useState<string>('')
  const [customHours, setCustomHours] = useState<string>('')
  const [maxDevices, setMaxDevices] = useState<string>('1')

  // Create Custom Key form state
  const [customTarget, setCustomTarget] = useState<'product' | 'agent'>('product')
  const [customDurationPreset, setCustomDurationPreset] = useState<string | null>(null)
  const [keyName, setKeyName] = useState<string>('')
  const [customKeyHours, setCustomKeyHours] = useState<string>('')
  const [customKeyMaxDevices, setCustomKeyMaxDevices] = useState<string>('1')

  const durationOptions = ['1H', '6H', '12H', '1D', '3D', '1W', '2W', '1M', '2M', '3M', '6M', '1Y']
  const metricCards = [
    { Icon: Key, title: "License Keys", val: "208", sub: "207 ACTIVE KEYS", label: "Active", accent: "text-primary", borderHover: "group-hover:border-primary/50" },
    { Icon: Package, title: "Products", val: "2", sub: "GLOBAL ITEMS", label: "DB", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" },
    { Icon: Folder, title: "Files", val: "0", sub: "SYSTEM FILES", label: "SYS", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" },
    { Icon: Zap, title: "Agents", val: "0", sub: "ONLINE NODES", label: "NET", accent: "text-text-secondary-dark", borderHover: "group-hover:border-primary/50" }
  ]

  const tabs = [
    { label: "License Keys", Icon: Key },
    { label: "File Manager", Icon: FolderOpen },
    { label: "Products", Icon: Package },
    { label: "Agents", Icon: Zap }
  ]

  return (
    <div className="space-y-5">
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

      <Tabs defaultValue="license-keys" className="w-full">
        <TabsList className="bg-surface-dark border-border-dark rounded p-1 flex items-center overflow-x-auto shadow-sm w-full">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.label} 
              value={tab.label.toLowerCase().replace(' ', '-')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-all uppercase tracking-wide data-[state=active]:font-bold data-[state=active]:bg-white/10 data-[state=active]:text-text-primary-dark data-[state=active]:border data-[state=active]:border-border-dark data-[state=active]:shadow-sm"
            >
              <tab.Icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="license-keys" className="mt-4">
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
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark'
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
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
                </div>
              </div>
              <div>
                <Label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</Label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent 
                    className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)]"
                    position="popper"
                  >
                    <SelectItem value="product-a" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Product A</SelectItem>
                    <SelectItem value="product-b" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Product B</SelectItem>
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
              <Button className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg">
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
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark'
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
                        : 'bg-transparent text-text-secondary-dark hover:text-text-primary-dark'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Agent
                  </Button>
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
          <div className="mt-6 flex flex-col gap-4 opacity-50 pointer-events-none grayscale">
            <Separator className="border-border-dark" />
            <div className="flex justify-end">
              <Button disabled className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all">
                <Plus className="h-3.5 w-3.5" />
                EXECUTE: CUSTOM KEY
              </Button>
            </div>
          </div>
        </Card>
      </div>

          {/* License Keys Table */}
          <LicenseKeysTable />
        </TabsContent>

        <TabsContent value="file-manager" className="mt-4">
          <FileManager />
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <div className="flex items-center justify-center h-64 text-text-secondary-dark">
            <p className="text-sm">Products tab content coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <div className="flex items-center justify-center h-64 text-text-secondary-dark">
            <p className="text-sm">Agents tab content coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
        <Separator className="absolute top-0 left-0 right-0" />
        <p>© 2025 SAAS MGR</p>
        <p className="font-mono-numbers">V.1.0.0-BETA</p>
      </div>
    </div>
  )
}

