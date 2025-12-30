"use client"

import React, { useState, useEffect } from 'react'
import { 
  Eye, 
  Settings, 
  Search, 
  Globe, 
  Router, 
  RefreshCw, 
  Power, 
  Monitor,
  Activity,
  Server
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  lastEvent: string
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

const SESSIONS: Session[] = [
  { id: 'sess_X92', user: 'phantom_01', hwid: 'HW-8293-AB', ip: '192.168.1.142', region: 'EU-West', latency: 24, product: 'Enterprise Suite v2', status: 'Online', uptime: '2h 14m', lastEvent: 'Config loaded' },
  { id: 'sess_A04', user: 'admin_dev', hwid: 'HW-1102-CC', ip: '10.0.0.5', region: 'NA-East', latency: 45, product: 'Dev Tools', status: 'Idle', uptime: '45m', lastEvent: 'Heartbeat received' },
  { id: 'sess_B77', user: 'guest_user', hwid: 'HW-5592-XY', ip: '172.16.0.22', region: 'Asia-South', latency: 120, product: 'Basic Plan', status: 'Unstable', uptime: '12m', lastEvent: 'Packet loss detected' },
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
      { id: 'esp_snaplines', label: 'Snaplines', type: 'toggle', value: false },
      { id: 'esp_distance', label: 'Render Dist.', type: 'slider', value: 500, min: 100, max: 2000 },
    ]
  },
  {
    id: 'misc',
    title: 'System & Misc',
    icon: <Settings className="size-3" />,
    features: [
      { id: 'radar_2d', label: 'Radar 2D', type: 'toggle', value: true },
      { id: 'perf_mode', label: 'Perf. Mode', type: 'toggle', value: false },
      { id: 'panic_key', label: 'Panic Key', type: 'select', value: 'F12', options: ['F12', 'DELETE', 'INSERT'] },
      { id: 'stream_proof', label: 'Stream Proof', type: 'toggle', value: true },
    ]
  }
]

// --- Components ---

export function RemoteControlPage() {
  const [selectedSession, setSelectedSession] = useState<Session>(SESSIONS[0])
  const [features, setFeatures] = useState<FeatureGroup[]>(INITIAL_FEATURES)
  const [searchTerm, setSearchTerm] = useState('')

  // Mock live latency
  const [latency, setLatency] = useState(selectedSession.latency)

  useEffect(() => {
    const interval = setInterval(() => {
        setLatency(prev => Math.max(10, prev + (Math.random() > 0.5 ? 2 : -2)))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setLatency(selectedSession.latency)
  }, [selectedSession])

  const handleFeatureChange = (groupId: string, featureId: string, newValue: any) => {
    setFeatures(prev => prev.map(group => {
      if (group.id !== groupId) return group
      return {
        ...group,
        features: group.features.map(f => {
          if (f.id === featureId) {
            return { ...f, value: newValue }
          }
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

  const filteredSessions = SESSIONS.filter(s => 
    s.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ip.includes(searchTerm)
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 px-4 lg:px-6">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[600px]">
            
            {/* LEFT COLUMN: Session List */}
            <Card className="md:col-span-3 lg:col-span-3 flex flex-col overflow-hidden bg-background shadow-sm border">
              <CardHeader className="p-3 pb-2 border-b space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Active Targets</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{filteredSessions.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input 
                    placeholder="Search user or IP..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 text-xs pl-7 bg-muted/30 border-muted-foreground/20"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-0.5 p-2">
                  {filteredSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={cn(
                        "flex flex-col gap-1 w-full text-left p-2 rounded-md transition-all border border-transparent",
                        selectedSession.id === session.id 
                          ? "bg-accent text-accent-foreground border-border shadow-sm" 
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium truncate">{session.user}</span>
                        <div className={cn("size-1.5 rounded-full", getStatusColor(session.status))} />
                      </div>
                      <div className="flex justify-between items-center w-full text-[10px] opacity-80">
                        <span className="font-mono">{session.ip}</span>
                        <span>{session.region}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT COLUMN: Control Panel */}
            <div className="md:col-span-9 lg:col-span-9 flex flex-col gap-3 overflow-hidden">
              
              {/* Header Info */}
              <Card className="p-3 border bg-background shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-muted/30 border flex items-center justify-center shrink-0">
                      <Monitor className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold">{selectedSession.user}</h2>
                        <Badge variant="outline" className="font-mono text-[10px] h-5 px-1 text-muted-foreground">
                          {selectedSession.hwid}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Globe className="size-3" /> {selectedSession.region}</span>
                        <span className="flex items-center gap-1"><Server className="size-3" /> {selectedSession.product}</span>
                        <span className="flex items-center gap-1"><Activity className="size-3" /> {selectedSession.uptime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pl-3 md:pl-0 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-right mr-2">
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Latency</div>
                      <div className={cn("text-sm font-mono font-bold", latency > 100 ? 'text-rose-500' : 'text-emerald-500')}>
                        {latency} ms
                      </div>
                    </div>
                    <Separator orientation="vertical" className="h-8 hidden md:block" />
                    <div className="flex gap-1">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs gap-1.5 px-2.5"
                        >
                            <RefreshCw className="size-3" /> Reconnect
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-7 text-xs gap-1.5 px-2.5"
                        >
                            <Power className="size-3" /> Kill
                        </Button>
                    </div>
                  </div>

                </div>
              </Card>

              {/* Feature Grid */}
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 overflow-y-auto pr-1">
                {features.map(group => (
                  <Card key={group.id} className="flex flex-col bg-background shadow-sm border h-fit">
                    <CardHeader className="p-3 pb-2 border-b bg-muted/10">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-background border shadow-sm text-muted-foreground">
                          {group.icon}
                        </div>
                        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 space-y-1">
                      {group.features.map((feature, idx) => (
                        <div key={feature.id} className="flex items-center justify-between py-1.5 group hover:bg-muted/30 rounded px-1 transition-colors">
                            <div className="flex flex-col gap-0.5">
                                <Label htmlFor={feature.id} className="text-xs font-medium cursor-pointer">
                                    {feature.label}
                                </Label>
                                <span className="text-[9px] text-muted-foreground font-mono opacity-50 hidden group-hover:block">
                                    {feature.id}
                                </span>
                            </div>
                          
                            <div className="w-32 flex justify-end">
                                {feature.type === 'toggle' && (
                                <Switch 
                                    id={feature.id}
                                    checked={feature.value as boolean} 
                                    onCheckedChange={(val) => handleFeatureChange(group.id, feature.id, val)}
                                    className="scale-90" 
                                />
                                )}
                                
                                {feature.type === 'slider' && (
                                <div className="flex items-center gap-2 w-full">
                                    <Slider 
                                        value={[feature.value as number]} 
                                        min={feature.min} 
                                        max={feature.max}
                                        onValueChange={(vals) => handleFeatureChange(group.id, feature.id, vals[0])}
                                        className="flex-1"
                                    />
                                    <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">
                                        {feature.value}
                                    </span>
                                </div>
                                )}

                                {feature.type === 'select' && feature.options && (
                                <Select 
                                    value={feature.value as string}
                                    onValueChange={(val) => handleFeatureChange(group.id, feature.id, val)}
                                >
                                    <SelectTrigger className="w-full text-[10px] h-6 px-2 bg-muted/30 border-muted-foreground/20">
                                    <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {feature.options.map(opt => (
                                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                )}
                            </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}