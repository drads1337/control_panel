"use client"

import React, { useState } from 'react'
import { 
  Shield, 
  GlobeLock, 
  Smartphone, 
  Server, 
  Bug, 
  Globe, 
  Ban, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Plus, 
  History, 
  Trash2,
  Clock,
  Filter
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// --- Types ---

interface SecurityModule {
  id: string
  name: string
  description: string
  status: boolean
  icon: React.ReactNode
  severity: 'Low' | 'Medium' | 'High'
}

interface BanEntry {
  id: string
  type: 'HWID' | 'IP'
  value: string
  reason: string
  date: string
  status: 'Active' | 'Expired'
}

// --- Data ---

const INITIAL_MODULES: SecurityModule[] = [
  { id: 'm1', name: 'VPN / Proxy Detection', description: 'Block connections from known VPN providers and TOR nodes.', status: true, icon: <GlobeLock className="size-4" />, severity: 'Medium' },
  { id: 'm2', name: 'Hardware ID Lock', description: 'Enforce strict single-device usage policy per license.', status: true, icon: <Smartphone className="size-4" />, severity: 'High' },
  { id: 'm3', name: 'Virtual Machine Block', description: 'Prevent execution in VMware, VirtualBox, Hyper-V.', status: false, icon: <Server className="size-4" />, severity: 'Low' },
  { id: 'm4', name: 'Anti-Debug / Tamper', description: 'Detect active debuggers and memory injection.', status: true, icon: <Bug className="size-4" />, severity: 'High' },
  { id: 'm5', name: 'IP Reputation Check', description: 'Filter traffic based on global threat intelligence.', status: false, icon: <Globe className="size-4" />, severity: 'Medium' },
]

const INITIAL_BANS: BanEntry[] = [
  { id: 'b1', type: 'IP', value: '45.12.89.122', reason: 'Brute Force Attempt', date: '2023-10-25 14:30', status: 'Active' },
  { id: 'b2', type: 'HWID', value: 'HW-8821-XX-99', reason: 'Account Sharing', date: '2023-10-24 09:15', status: 'Active' },
  { id: 'b3', type: 'IP', value: '192.168.1.55', reason: 'Suspicious Activity', date: '2023-10-23 18:45', status: 'Expired' },
  { id: 'b4', type: 'HWID', value: 'HW-1102-AB-00', reason: 'Debugger Detected', date: '2023-10-22 11:20', status: 'Active' },
  { id: 'b5', type: 'IP', value: '185.200.11.2', reason: 'VPN Detected', date: '2023-10-21 16:10', status: 'Active' },
]

export function SecurityPage() {
  const [modules, setModules] = useState(INITIAL_MODULES)
  const [bans, setBans] = useState(INITIAL_BANS)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('HWID')

  const toggleModule = (id: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, status: !m.status } : m))
  }

  const handleDeleteBan = (id: string) => {
    setBans(prev => prev.filter(b => b.id !== id))
  }

  const filteredBans = bans.filter(b => 
    b.type === activeTab && 
    b.value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'High': return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'Medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 px-4 lg:px-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[600px]">
            
            {/* LEFT COLUMN: Modules & Stats (Spans 8 cols on large screens) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              {/* Stats Overview */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                <Card className="@container/card p-3">
                  <CardHeader className="p-0 pb-1">
                    <CardDescription className="text-xs">Security Score</CardDescription>
                    <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                      94%
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        <ShieldCheck className="size-3" />
                        Active
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                    <div className="line-clamp-1 flex gap-1.5 font-medium">
                      System security status{" "}
                      <ShieldCheck className="size-3" />
                    </div>
                    <div className="text-muted-foreground">
                      Overall security score
                    </div>
                  </CardFooter>
                </Card>
                <Card className="@container/card p-3">
                  <CardHeader className="p-0 pb-1">
                    <CardDescription className="text-xs">Threats Blocked</CardDescription>
                    <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                      1,204
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        <Shield className="size-3" />
                        Blocked
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                    <div className="line-clamp-1 flex gap-1.5 font-medium">
                      Total threats blocked{" "}
                      <Shield className="size-3" />
                    </div>
                    <div className="text-muted-foreground">
                      Security threats prevented
                    </div>
                  </CardFooter>
                </Card>
                <Card className="@container/card p-3">
                  <CardHeader className="p-0 pb-1">
                    <CardDescription className="text-xs">Active Bans</CardDescription>
                    <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                      {bans.filter(b => b.status === 'Active').length}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        <ShieldAlert className="size-3" />
                        Active
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                    <div className="line-clamp-1 flex gap-1.5 font-medium">
                      Currently active bans{" "}
                      <ShieldAlert className="size-3" />
                    </div>
                    <div className="text-muted-foreground">
                      IP and HWID bans active
                    </div>
                  </CardFooter>
                </Card>
              </div>

              {/* Modules List */}
              <Card className="flex flex-col flex-1 border bg-background shadow-sm overflow-hidden">
                <CardHeader className="p-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Shield className="size-4 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase tracking-wide">Protection Modules</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                        {modules.filter(m => m.status).length} / {modules.length} Active
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto">
                    <div className="flex flex-col p-2 gap-2">
                        {modules.map(module => (
                            <div 
                                key={module.id} 
                                className={cn(
                                    "flex items-start justify-between p-3 rounded-md border transition-all",
                                    module.status ? "bg-card border-border shadow-sm" : "bg-muted/20 border-transparent opacity-80"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "p-2 rounded-md shrink-0 flex items-center justify-center border",
                                        module.status ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
                                    )}>
                                        {module.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-semibold">{module.name}</h4>
                                            {module.status && (
                                                <span className="flex relative size-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                                            {module.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border", getSeverityColor(module.severity))}>
                                        {module.severity}
                                    </div>
                                    <Switch 
                                        checked={module.status}
                                        onCheckedChange={() => toggleModule(module.id)}
                                        className="scale-90"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Blacklist Manager (Spans 4 cols on large screens) */}
            <Card className="lg:col-span-4 flex flex-col border bg-background shadow-sm overflow-hidden">
                <CardHeader className="p-3 border-b space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Ban className="size-4 text-rose-500" />
                            <CardTitle className="text-sm font-bold uppercase tracking-wide">Blacklist</CardTitle>
                        </div>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
                            <Plus className="size-3" /> Add Ban
                        </Button>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-8">
                            <TabsTrigger value="HWID" className="text-xs">Hardware ID</TabsTrigger>
                            <TabsTrigger value="IP" className="text-xs">IP Address</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                        <Input 
                            placeholder={`Search ${activeTab}...`} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-8 text-xs pl-8 bg-muted/30 border-muted-foreground/20"
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="flex flex-col p-2 gap-1.5">
                            {filteredBans.length > 0 ? (
                                filteredBans.map(ban => (
                                    <div key={ban.id} className="group flex flex-col p-2.5 rounded-md border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="font-mono text-[10px] font-bold bg-muted/50 px-1.5 py-0.5 rounded text-foreground border border-border/50">
                                                {ban.value}
                                            </div>
                                            <Badge 
                                                variant="outline" 
                                                className={cn(
                                                    "text-[9px] h-4 px-1 rounded-sm",
                                                    ban.status === 'Active' 
                                                        ? "text-rose-500 bg-rose-500/5 border-rose-500/20" 
                                                        : "text-muted-foreground bg-muted border-transparent"
                                                )}
                                            >
                                                {ban.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] font-medium text-muted-foreground">{ban.reason}</div>
                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                                                    <Clock className="size-2.5" /> {ban.date}
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteBan(ban.id)}
                                                className="size-6 text-muted-foreground hover:text-rose-500 -mb-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="size-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50">
                                    <Filter className="size-8 mb-2 stroke-1" />
                                    <span className="text-xs">No entries found</span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>

                <div className="p-2 border-t bg-muted/10">
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-2 text-muted-foreground">
                        <History className="size-3" /> View Access Logs
                    </Button>
                </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}