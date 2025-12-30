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
  Monitor
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
import { Card, CardContent } from '@/components/ui/card'
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
    title: 'Visual Assistance (ESP)',
    icon: <Eye className="size-4" />,
    features: [
      { id: 'esp_master', label: 'Master Switch', type: 'toggle', value: true },
      { id: 'esp_box', label: 'Box Type', type: 'select', value: '2D Corners', options: ['2D Full', '2D Corners', '3D Box'] },
      { id: 'esp_skeleton', label: 'Skeleton Overlay', type: 'toggle', value: true },
      { id: 'esp_snaplines', label: 'Snaplines', type: 'toggle', value: false },
      { id: 'esp_distance', label: 'Render Distance', type: 'slider', value: 500, min: 100, max: 2000 },
    ]
  },
  {
    id: 'misc',
    title: 'System & Misc',
    icon: <Settings className="size-4" />,
    features: [
      { id: 'radar_2d', label: 'Radar 2D', type: 'toggle', value: true },
      { id: 'perf_mode', label: 'Performance Mode', type: 'toggle', value: false },
      { id: 'panic_key', label: 'Panic Key', type: 'select', value: 'F12', options: ['F12', 'DELETE', 'INSERT'] },
      { id: 'stream_proof', label: 'Stream Proof', type: 'toggle', value: true },
    ]
  }
]

// --- Components ---

const LogTerminal: React.FC<{ logs: string[] }> = ({ logs }) => (
  <div className="bg-black/90 text-green-500 font-mono text-[10px] p-3 rounded-lg h-32 overflow-y-auto border border-gray-800 shadow-inner">
    {logs.map((log, i) => (
      <div key={i} className="mb-0.5 opacity-90 border-l-2 border-transparent hover:border-green-500 pl-1 transition-all">
        <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
        {log}
      </div>
    ))}
    <div className="animate-pulse">_</div>
  </div>
)

export function RemoteControlPage() {
  const [selectedSession, setSelectedSession] = useState<Session>(SESSIONS[0])
  const [features, setFeatures] = useState<FeatureGroup[]>(INITIAL_FEATURES)
  const [logs, setLogs] = useState<string[]>(['System initialized.', 'Connected to remote host.', 'Config loaded successfully.'])
  const [searchTerm, setSearchTerm] = useState('')

  const handleFeatureChange = (groupId: string, featureId: string, newValue: any) => {
    setFeatures(prev => prev.map(group => {
      if (group.id !== groupId) return group
      return {
        ...group,
        features: group.features.map(f => {
          if (f.id === featureId) {
            addLog(`Changed ${f.label} to ${newValue}`)
            return { ...f, value: newValue }
          }
          return f
        })
      }
    }))
  }

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50))
  }

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Online': return 'bg-green-500'
        case 'Idle': return 'bg-amber-500'
        case 'Unstable': return 'bg-red-500'
        default: return 'bg-gray-400'
    }
  }

  // Mock live latency updates
  const [latency, setLatency] = useState(selectedSession.latency)
  useEffect(() => {
    const interval = setInterval(() => {
        setLatency(prev => Math.max(10, prev + (Math.random() > 0.5 ? 2 : -2)))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setLatency(selectedSession.latency)
    addLog(`Switched target to ${selectedSession.user}`)
  }, [selectedSession])

  const filteredSessions = SESSIONS.filter(s => 
    s.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ip.includes(searchTerm)
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="h-[700px] flex gap-6 animate-in fade-in duration-300 mx-4 lg:mx-6">
            
            {/* Sidebar: Sessions List */}
            <Card className="w-64 flex flex-col overflow-hidden flex-shrink-0">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="pb-4 border-b">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Active Targets ({filteredSessions.length})
                  </h3>
                  <div className="relative">
                    <Search className="absolute inset-y-0 left-0 flex items-center pl-2 text-muted-foreground size-4" />
                    <Input 
                      type="text" 
                      placeholder="Filter by IP or User..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto mt-4">
                  {filteredSessions.map(session => (
                    <button 
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={cn(
                        "w-full text-left p-3 border-l-2 transition-all hover:bg-muted rounded-r-md mb-1",
                        selectedSession.id === session.id 
                          ? 'bg-primary/10 dark:bg-primary/20 border-primary' 
                          : 'border-transparent'
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold truncate">{session.user}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", getStatusColor(session.status))}></span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="font-mono">{session.ip}</span>
                        <span>{session.uptime}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Main Panel: Controls */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              
              {/* Top Bar: Target Info */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <Monitor className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        {selectedSession.user}
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted font-mono">
                          {selectedSession.hwid}
                        </span>
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Globe className="size-3" /> {selectedSession.region}
                        </span>
                        <span className="flex items-center gap-1">
                          <Router className="size-3" /> {selectedSession.ip}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Latency
                      </div>
                      <div className={cn(
                        "text-xl font-mono font-bold",
                        latency > 100 ? 'text-red-500' : 'text-green-500'
                      )}>
                        {latency}ms
                      </div>
                    </div>
                    <div className="h-8 w-px bg-border"></div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => addLog('Sent command: FORCE_RECONNECT')} 
                      title="Reconnect"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => addLog('Sent command: TERMINATE_SESSION')} 
                      title="Terminate"
                      className="text-destructive hover:text-destructive"
                    >
                      <Power className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                {features.map(group => (
                  <Card key={group.id} className="flex flex-col h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6 pb-2 border-b">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                          <span className="text-muted-foreground">{group.icon}</span> {group.title}
                        </h3>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      </div>
                      
                      <div className="space-y-5">
                        {group.features.map(feature => (
                          <div key={feature.id} className="flex items-center justify-between group">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                {feature.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">ID: {feature.id}</span>
                            </div>
                            
                            <div className="w-32 flex justify-end">
                              {feature.type === 'toggle' && (
                                <Switch 
                                  checked={feature.value as boolean} 
                                  onCheckedChange={(val) => handleFeatureChange(group.id, feature.id, val)} 
                                />
                              )}
                              
                              {feature.type === 'slider' && (
                                <div className="flex items-center gap-3 w-full">
                                  <Slider 
                                    value={[feature.value as number]} 
                                    min={feature.min || 0} 
                                    max={feature.max || 100}
                                    onValueChange={(vals) => handleFeatureChange(group.id, feature.id, vals[0])}
                                    className="flex-1"
                                  />
                                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                                    {feature.value}
                                  </span>
                                </div>
                              )}

                              {feature.type === 'select' && feature.options && (
                                <Select 
                                  value={feature.value as string}
                                  onValueChange={(val) => handleFeatureChange(group.id, feature.id, val)}
                                >
                                  <SelectTrigger className="w-full text-xs h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {feature.options.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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

              {/* Console / Log Area */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Live Console Output
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setLogs([])} 
                    className="text-[10px] h-auto py-0"
                  >
                    Clear Logs
                  </Button>
                </div>
                <LogTerminal logs={logs} />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
