import React from 'react'
import { Users as UsersIcon, Activity, Shield, UserX, ShieldCheck, FileEdit, Eye, Search, Filter, Download, UserPlus, Code, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { Input } from '@/shared/ui/components/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/components/table'
import { Badge } from '@/shared/ui/components/badge'
import { Avatar, AvatarFallback } from '@/shared/ui/components/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/components/tabs'
import { Separator } from '@/shared/ui/components/separator'
import { Checkbox } from '@/shared/ui/components/checkbox'

export function UsersPage() {
  return (
    <div className="space-y-5">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {[
                { label: 'Total Users', val: '1,248', sub: '+12 THIS WEEK', Icon: UsersIcon, LargeIcon: UsersIcon },
                { label: 'Active Now', val: '86', sub: 'LIVE SESSIONS', Icon: Activity, LargeIcon: Activity, pulse: true },
                { label: 'Administrators', val: '42', sub: 'PRIVILEGED', Icon: Shield, LargeIcon: Shield },
                { label: 'Inactive', val: '15', sub: 'REQUIRES REVIEW', Icon: UserX, LargeIcon: UserX },
            ].map((stat, i) => (
                <Card key={i} className="bg-surface-dark border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                     <div className="flex justify-between items-start z-10">
                        <div className={`flex items-center gap-2 ${i === 1 ? 'text-primary' : 'text-text-secondary-dark'} text-xs font-semibold uppercase tracking-wider`}>
                            <stat.Icon className="h-3.5 w-3.5" />
                            {stat.label}
                        </div>
                        {i === 1 && <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>}
                        {i === 3 && <span className="text-text-secondary-dark text-[10px] uppercase font-bold tracking-widest font-mono-numbers opacity-60">30D</span>}
                    </div>
                    <div className="z-10 flex items-end justify-between">
                        <div className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark font-mono-numbers tracking-tight">{stat.val}</div>
                        <div className="text-[10px] text-text-secondary-dark mb-1 font-mono-numbers text-right">{stat.sub}</div>
                    </div>
                     <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <stat.LargeIcon className="h-32 w-32" />
                    </div>
                </Card>
            ))}
       </div>

       <Tabs defaultValue="all-users" className="w-full">
        <TabsList className="bg-surface-dark border-border-dark rounded p-1 flex items-center overflow-x-auto shadow-sm w-full">
          {[
            { label: 'All Users', Icon: UsersIcon, value: 'all-users' },
            { label: 'Admins', Icon: ShieldCheck, value: 'admins' },
            { label: 'Editors', Icon: FileEdit, value: 'editors' },
            { label: 'Viewers', Icon: Eye, value: 'viewers' }
          ].map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-all uppercase tracking-wide data-[state=active]:font-bold data-[state=active]:bg-white/10 data-[state=active]:text-text-primary-dark data-[state=active]:border data-[state=active]:border-border-dark data-[state=active]:shadow-sm"
            >
              <tab.Icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
       </Tabs>

       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 mb-2">
            <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                </span>
                <Input className="pl-9 pr-4 py-1.5 bg-surface-dark border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-64 placeholder-text-secondary-dark transition-all shadow-sm" placeholder="Find by name, email or ID..." type="text"/>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="px-3 py-1.5 bg-surface-dark border-border-dark hover:border-text-secondary-dark rounded text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">FILTER</span>
                </Button>
                 <Button variant="outline" size="sm" className="px-3 py-1.5 bg-surface-dark border-border-dark hover:border-text-secondary-dark rounded text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">EXPORT</span>
                </Button>
                 <Button size="sm" className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-background-dark rounded text-xs font-bold transition-all shadow-glow">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">ADD USER</span>
                </Button>
            </div>
       </div>

       <Card className="bg-surface-dark border-border-dark rounded overflow-hidden">
        <Table>
            <TableHeader>
                <TableRow className="border-b border-border-dark bg-white/5 hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest w-12">
                        <Checkbox className="w-4 h-4 border-border-dark bg-background-dark" />
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">User Profile</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Role</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Status</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Last Active</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border-dark/50">
                    {/* User 1 */}
                     <TableRow className="group hover:bg-white/5 transition-colors">
                        <TableCell className="px-4 py-3 align-middle">
                             <Checkbox className="w-4 h-4 border-border-dark bg-background-dark cursor-pointer group-hover:border-primary transition-colors" />
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/20">
                                        SJ
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="text-xs font-semibold text-text-primary-dark">Sarah Jenkins</div>
                                    <div className="text-[10px] text-text-secondary-dark font-mono font-mono-numbers">sarah.j@company.com</div>
                                </div>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                            <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium text-text-primary-dark">
                                <Shield className="h-3 w-3 text-indigo-400" />
                                Administrator
                            </Badge>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-medium text-emerald-500 tracking-wide uppercase">Active</span>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <span className="text-[10px] text-text-primary-dark font-mono-numbers">2m ago</span>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle text-right">
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    {/* User 2 */}
                    <TableRow className="group hover:bg-white/5 transition-colors">
                         <TableCell className="px-4 py-3 align-middle">
                             <Checkbox className="w-4 h-4 border-border-dark bg-background-dark cursor-pointer group-hover:border-primary transition-colors" />
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-background-dark border border-border-dark text-text-secondary-dark text-xs font-bold">
                                        MC
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="text-xs font-semibold text-text-primary-dark">Michael Chen</div>
                                    <div className="text-[10px] text-text-secondary-dark font-mono font-mono-numbers">m.chen@dev.io</div>
                                </div>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                            <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium text-text-secondary-dark">
                                <Code className="h-3 w-3" />
                                Developer
                            </Badge>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50"></span>
                                <span className="text-[10px] font-medium text-text-secondary-dark tracking-wide uppercase">Idle</span>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <span className="text-[10px] text-text-secondary-dark font-mono-numbers">14m ago</span>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle text-right">
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    {/* User 3 */}
                     <TableRow className="group hover:bg-white/5 transition-colors">
                         <TableCell className="px-4 py-3 align-middle">
                             <Checkbox className="w-4 h-4 border-border-dark bg-background-dark cursor-pointer group-hover:border-primary transition-colors" />
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-background-dark border border-border-dark text-text-secondary-dark text-xs font-bold">
                                        AT
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="text-xs font-semibold text-text-primary-dark">Aria Thorne</div>
                                    <div className="text-[10px] text-text-secondary-dark font-mono font-mono-numbers">aria.t@partner.net</div>
                                </div>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                            <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium text-text-secondary-dark">
                                <Eye className="h-3 w-3" />
                                Viewer
                            </Badge>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-inactive-dark"></span>
                                <span className="text-[10px] font-medium text-inactive-dark tracking-wide uppercase">Offline</span>
                            </div>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle">
                             <span className="text-[10px] text-text-secondary-dark font-mono-numbers opacity-60">2d ago</span>
                        </TableCell>
                         <TableCell className="px-4 py-3 align-middle text-right">
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </TableCell>
                    </TableRow>
                </TableBody>
        </Table>
        <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
            <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                Showing 1-5 of 1,248 Users
            </div>
            <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" className="w-6 h-6 text-text-secondary-dark hover:bg-white/5 disabled:opacity-30" disabled>
                    <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-text-primary-dark font-mono-numbers px-2">PAGE 01</span>
                 <Button variant="ghost" size="icon" className="w-6 h-6 text-text-secondary-dark hover:bg-white/5">
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
       </Card>

        <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
            <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
            <p>© 2025 SAAS MGR</p>
            <p className="font-mono-numbers">V.1.0.0-BETA</p>
        </div>
    </div>
  )
}

