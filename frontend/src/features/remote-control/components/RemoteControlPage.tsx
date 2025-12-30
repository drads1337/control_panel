"use client"

import React, { useState, useEffect } from 'react'
import { 
  Eye, 
  Settings, 
  Globe, 
  RefreshCw, 
  Power, 
  Monitor,
  Activity,
  Server,
  Wifi,
  Cpu,
  Box
} from 'lucide-react'
import { cn } from '@/lib/utils'

// UI Components
import { Card, CardContent, CardTitle } from '@/components/ui/card'
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
  type: 'toggle' | 'slider' | 'select'
  value: boolean | number | string
  min?: number
  max?: number
  options?: string[]
}

// --- Mock Data ---

interface Product {
  id: string
  name: string
}

const PRODUCTS: Product[] = [
  { id: 'prod_1', name: 'Enterprise Suite v2' },
  { id: 'prod_2', name: 'Dev Tools' },
  { id: 'prod_3', name: 'Basic Plan' },
  { id: 'prod_4', name: 'Pro Edition' },
  { id: 'prod_5', name: 'Starter Pack' },
]

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
      { id: 'esp_dist', label: 'Render Distance', type: 'slider', value: 500, min: 100, max: 2000 },
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(PRODUCTS[0])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [features, setFeatures] = useState<FeatureGroup[]>(INITIAL_FEATURES)
  const [latency, setLatency] = useState(0)

  // Simulation of live latency
  useEffect(() => {
    const interval = setInterval(() => {
        setLatency(prev => Math.max(10, prev + (Math.random() > 0.5 ? 3 : -3)))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedSession) {
      setLatency(selectedSession.latency)
    }
  }, [selectedSession])

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
          <div className="px-4 lg:px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[550px]">
        
        {/* --- LEFT COLUMN: Product List --- */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col min-h-[550px] border rounded-lg bg-background shadow-sm overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <div className="space-y-0.5 mb-3">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Products
                </div>
                {PRODUCTS.map((product) => {
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
            
            {/* Header Info Card */}
            {selectedSession ? (
              <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Cpu className="size-4 text-primary" />
                      </div>
                      <div>
                          <div className="flex items-center gap-2">
                              <h2 className="text-sm font-semibold">{selectedSession.user}</h2>
                              <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border-muted-foreground/10">
                                  {selectedSession.hwid}
                              </Badge>
                              <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 font-normal", 
                                  selectedSession.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-muted-foreground/10')}>
                                  {selectedSession.status}
                              </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><Globe className="size-3" /> {selectedSession.region}</span>
                              <span className="flex items-center gap-1"><Activity className="size-3" /> Uptime: {selectedSession.uptime}</span>
                              <span className="flex items-center gap-1"><Wifi className="size-3" /> Latency: {latency}ms</span>
                          </div>
                      </div>
                  </div>

                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1.5 bg-background hover:bg-muted/50">
                          <RefreshCw className="size-3" /> Reconnect
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2.5 gap-1.5">
                          <Power className="size-3" /> Terminate
                      </Button>
                  </div>
              </div>
            ) : (
              <div className="flex items-center justify-center px-4 py-2 border-b bg-background h-[52px] shrink-0">
                <span className="text-sm text-muted-foreground">No sessions available for selected product</span>
              </div>
            )}

            {/* Features Grid */}
            {selectedSession ? (
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
                                                
                                                {feature.type === 'slider' && (
                                                    <div className="flex items-center gap-2 w-full pl-2">
                                                        <Slider 
                                                            value={[feature.value as number]} 
                                                            min={feature.min} 
                                                            max={feature.max}
                                                            step={10}
                                                            onValueChange={(vals) => handleFeatureChange(group.id, feature.id, vals[0])}
                                                            className="flex-1"
                                                        />
                                                        <span className="text-[10px] font-mono text-muted-foreground min-w-[30px] text-right">
                                                            {feature.value}
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
                <span className="text-sm text-muted-foreground">Select a product to view sessions</span>
              </div>
            )}
        </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}