import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users as UsersIcon, Activity, Shield, UserX, ShieldCheck, FileEdit, Eye, Search, Filter, Download, UserPlus, Code, MoreHorizontal, ChevronLeft, ChevronRight, Users2, UserCheck, KeyRound } from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { Input } from '@/shared/ui/components/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/components/table'
import { Badge } from '@/shared/ui/components/badge'
import { Avatar, AvatarFallback } from '@/shared/ui/components/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/components/tabs'
import { Checkbox } from '@/shared/ui/components/checkbox'
import { useUsersQuery, getClients } from '@/entities/user'
import { useReferrals } from '@/features/user-administration/hooks/use-referrals'
import { useRBAC } from '@/features/user-administration/hooks/use-rbac'
import type { User } from '@/entities/user'
import type { ReferralCode } from '@/features/user-administration/hooks/use-referrals'
import type { Role } from '@/features/user-administration/hooks/use-rbac'

export function UsersPage() {
  const [activeTab, setActiveTab] = useState('employees')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Employees query
  const employeesQuery = useUsersQuery({
    roles: ['admin', 'moderator', 'developer', 'seller', 'support', 'owner'],
  })
  
  // Update search when query changes for employees tab
  useEffect(() => {
    if (activeTab === 'employees') {
      if (searchQuery) {
        employeesQuery.setSearch(searchQuery)
      } else {
        employeesQuery.setSearch('')
      }
    }
  }, [searchQuery, activeTab])
  
  // Clients query
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', searchQuery],
    queryFn: async () => {
      const response = await getClients()
      return response.clients || []
    },
    staleTime: 2 * 60 * 1000,
  })
  
  // Referral codes
  const { codes: referralCodes, isLoading: referralCodesLoading } = useReferrals()
  
  // RBAC roles and permissions
  const { roles: rbacRoles, permissions: rbacPermissions, isLoading: rbacLoading } = useRBAC()
  
  const employees = employeesQuery.users || []
  const clients = clientsData || []
  
  // Filter clients and referral codes/RBAC on frontend since they don't support search params
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients
    const query = searchQuery.toLowerCase()
    return clients.filter((client: any) => 
      client.username?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.name?.toLowerCase().includes(query)
    )
  }, [clients, searchQuery])
  
  const filteredReferralCodes = useMemo(() => {
    if (!searchQuery) return referralCodes
    const query = searchQuery.toLowerCase()
    return referralCodes.filter(code => 
      code.code?.toLowerCase().includes(query)
    )
  }, [referralCodes, searchQuery])
  
  const filteredRBACRoles = useMemo(() => {
    if (!searchQuery) return rbacRoles
    const query = searchQuery.toLowerCase()
    return rbacRoles.filter(role => 
      role.name?.toLowerCase().includes(query) ||
      role.description?.toLowerCase().includes(query)
    )
  }, [rbacRoles, searchQuery])
  
  // Group permissions by resource for better display
  const groupedPermissions = useMemo(() => {
    if (!rbacPermissions) return {}
    const grouped: Record<string, Array<{ id: number; name: string; description: string; action: string }>> = {}
    Object.entries(rbacPermissions).forEach(([resource, perms]) => {
      if (Array.isArray(perms)) {
        grouped[resource] = perms
      }
    })
    return grouped
  }, [rbacPermissions])
  
  // Filter grouped permissions
  const filteredGroupedPermissions = useMemo(() => {
    if (!searchQuery) return groupedPermissions
    const query = searchQuery.toLowerCase()
    const filtered: Record<string, Array<{ id: number; name: string; description: string; action: string }>> = {}
    
    Object.entries(groupedPermissions).forEach(([resource, perms]) => {
      const matchingPerms = perms.filter(perm => 
        perm.name?.toLowerCase().includes(query) ||
        perm.description?.toLowerCase().includes(query) ||
        resource?.toLowerCase().includes(query) ||
        perm.action?.toLowerCase().includes(query)
      )
      if (matchingPerms.length > 0 || resource.toLowerCase().includes(query)) {
        filtered[resource] = matchingPerms.length > 0 ? matchingPerms : perms
      }
    })
    return filtered
  }, [groupedPermissions, searchQuery])
  
  const totalPermissionsCount = useMemo(() => {
    return Object.values(filteredGroupedPermissions).reduce((sum, perms) => sum + perms.length, 0)
  }, [filteredGroupedPermissions])
  
  const renderUserRow = (user: User | any, isClient = false) => (
    <TableRow key={user.id} className="group hover:bg-white/5 transition-colors">
      <TableCell className="px-4 py-3 align-middle">
        <Checkbox className="w-4 h-4 border-border-dark bg-background-dark cursor-pointer group-hover:border-primary transition-colors" />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-gray-700 text-gray-200 text-xs font-bold">
              {user.first_name?.[0] || user.name?.[0] || user.username?.[0] || 'U'}
              {user.last_name?.[0] || user.name?.split(' ')[1]?.[0] || ''}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-xs font-semibold text-text-primary-dark">
              {user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.name || user.username}
            </div>
            <div className="text-[10px] text-text-secondary-dark font-mono font-mono-numbers">
              {user.email || user.username}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium text-text-primary-dark">
          {isClient ? (
            <>
              <UserCheck className="h-3 w-3 text-gray-400" />
              Client
            </>
          ) : (
            <>
              <Shield className="h-3 w-3 text-gray-400" />
              {user.roles?.[0] || 'User'}
            </>
          )}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2">
          {(!user.expires_at || new Date(user.expires_at) > new Date()) ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-medium text-emerald-500 tracking-wide uppercase">Active</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-inactive-dark"></span>
              <span className="text-[10px] font-medium text-inactive-dark tracking-wide uppercase">Offline</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-primary-dark font-mono-numbers">
          {(() => {
            const userRole = Array.isArray(user.roles) 
              ? user.roles[0]?.toLowerCase() 
              : typeof user.roles === 'string' 
                ? user.roles.toLowerCase() 
                : '';
            if (userRole === 'admin' || userRole === 'owner') {
              return 'Unlimited';
            }
            if (user.expires_at) {
              return new Date(user.expires_at).toLocaleDateString();
            }
            return 'N/A';
          })()}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-right">
        <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
  
  const renderReferralCodeRow = (code: ReferralCode) => (
    <TableRow key={code.id} className="group hover:bg-white/5 transition-colors">
      <TableCell className="px-4 py-3 align-middle">
        <div className="text-xs font-semibold text-text-primary-dark font-mono">{code.code}</div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium">
          {code.used ? (
            <span className="text-emerald-500">Used</span>
          ) : code.is_expired ? (
            <span className="text-inactive-dark">Expired</span>
          ) : (
            <span className="text-primary">Active</span>
          )}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-secondary-dark">
          {code.roles?.map(r => r.name).join(', ') || code.role || 'No roles'}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-primary-dark font-mono-numbers">
          {code.token_balance || 0} tokens
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-secondary-dark font-mono-numbers">
          {code.expires_at 
            ? new Date(code.expires_at).toLocaleDateString()
            : 'Never'}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-right">
        <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
  
  const renderRBACRoleRow = (role: Role) => (
    <TableRow key={role.id} className="group hover:bg-white/5 transition-colors">
      <TableCell className="px-4 py-3 align-middle">
        <div className="text-xs font-semibold text-text-primary-dark">{role.name}</div>
        <div className="text-[10px] text-text-secondary-dark">{role.description}</div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border-border-dark bg-background-dark text-[10px] font-medium">
          {role.is_system_role ? (
            <span className="text-indigo-400">System</span>
          ) : (
            <span className="text-text-primary-dark">Custom</span>
          )}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-primary-dark font-mono-numbers">
          {role.permissions?.length || 0} permissions
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="text-[10px] text-text-primary-dark font-mono-numbers">
          {role.user_count || 0} users
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-right">
        <Button variant="ghost" size="icon" className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
  
  const renderPermissionItem = (perm: { id: number; name: string; description: string; action: string }, resource: string) => (
    <div key={`${resource}-${perm.id}`} className="p-3 bg-background-dark/50 rounded border border-border-dark/50 hover:border-border-dark hover:bg-background-dark transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-text-primary-dark">{perm.name}</span>
            <Badge variant="outline" className="px-1.5 py-0.5 rounded border-border-dark bg-surface-dark text-[10px] font-medium text-primary">
              {perm.action}
            </Badge>
          </div>
          {perm.description && (
            <div className="text-[10px] text-text-secondary-dark mb-2 leading-relaxed">
              {perm.description}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="px-1.5 py-0.5 rounded border-border-dark bg-surface-dark text-[10px] font-medium text-text-secondary-dark">
              {resource}
            </Badge>
            <span className="text-[10px] text-text-secondary-dark font-mono">
              {resource}.{perm.action}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-text-secondary-dark hover:text-text-primary-dark flex-shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
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

       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                </span>
                <Input 
                  className="pl-9 pr-4 py-1.5 bg-surface-dark border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-64 placeholder-text-secondary-dark transition-all shadow-sm" 
                  placeholder={
                    activeTab === 'employees' ? 'Find employee by name, email or ID...' :
                    activeTab === 'clients' ? 'Find client by name, email or ID...' :
                    activeTab === 'rbac' ? 'Find role by name or description...' :
                    'Find referral code...'
                  }
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
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
                {(activeTab === 'employees' || activeTab === 'clients') && (
                  <Button size="sm" className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-background-dark rounded text-xs font-bold transition-all shadow-glow">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">ADD USER</span>
                  </Button>
                )}
            </div>
       </div>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-surface-dark border-border-dark rounded p-1 flex items-center overflow-x-auto shadow-sm w-full">
          {[
            { label: 'Employees', Icon: Users2, value: 'employees' },
            { label: 'Clients', Icon: UserCheck, value: 'clients' },
            { label: 'RBAC', Icon: ShieldCheck, value: 'rbac' },
            { label: 'Referral Code', Icon: KeyRound, value: 'referral-code' }
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
        
        <TabsContent value="employees" className="mt-4">
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
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Expires</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border-dark/50">
                {employeesQuery.loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      Loading employees...
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map(user => renderUserRow(user))
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
              <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                Showing {employees.length} of {employeesQuery.total} Employees
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="w-6 h-6 text-text-secondary-dark hover:bg-white/5 disabled:opacity-30" disabled={employeesQuery.currentPage === 1} onClick={() => employeesQuery.setPage(employeesQuery.currentPage - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-text-primary-dark font-mono-numbers px-2">PAGE {String(employeesQuery.currentPage).padStart(2, '0')}</span>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-text-secondary-dark hover:bg-white/5" disabled={employeesQuery.currentPage >= employeesQuery.pages} onClick={() => employeesQuery.setPage(employeesQuery.currentPage + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="clients" className="mt-4">
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
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Expires</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border-dark/50">
                {clientsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      Loading clients...
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client: any) => renderUserRow(client, true))
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
              <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                Showing {filteredClients.length} Clients
              </div>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="rbac" className="mt-4 space-y-4">
          {/* Roles Section */}
          <div>
            <div className="mb-2 px-2">
              <h3 className="text-xs font-bold text-text-primary-dark uppercase tracking-wider">Roles</h3>
            </div>
            <Card className="bg-surface-dark border-border-dark rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border-dark bg-white/5 hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Role Name</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Type</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Permissions</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Users</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border-dark/50">
                  {rbacLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                        Loading RBAC roles...
                      </TableCell>
                    </TableRow>
                  ) : filteredRBACRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                        No RBAC roles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRBACRoles.map(role => renderRBACRoleRow(role))
                  )}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
                <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                  Showing {filteredRBACRoles.length} Roles
                </div>
              </div>
            </Card>
          </div>
          
          {/* Permissions Section */}
          <div>
            <div className="mb-2 px-2">
              <h3 className="text-xs font-bold text-text-primary-dark uppercase tracking-wider">Permissions</h3>
            </div>
            <Card className="bg-surface-dark border-border-dark rounded overflow-hidden">
              <div className="p-4">
                {rbacLoading ? (
                  <div className="py-8 text-center text-text-secondary-dark text-xs">
                    Loading permissions...
                  </div>
                ) : Object.keys(filteredGroupedPermissions).length === 0 ? (
                  <div className="py-8 text-center text-text-secondary-dark text-xs">
                    No permissions found
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(filteredGroupedPermissions).map(([resource, perms]) => (
                      <div key={resource} className="space-y-2">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-dark/50">
                          <Badge variant="outline" className="px-2 py-1 rounded border-border-dark bg-background-dark text-xs font-bold text-text-primary-dark uppercase tracking-wider">
                            {resource}
                          </Badge>
                          <span className="text-[10px] text-text-secondary-dark font-mono-numbers">
                            {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {perms.map(perm => renderPermissionItem(perm, resource))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
                <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                  Showing {totalPermissionsCount} Permissions across {Object.keys(filteredGroupedPermissions).length} Resources
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="referral-code" className="mt-4">
          <Card className="bg-surface-dark border-border-dark rounded overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border-dark bg-white/5 hover:bg-transparent">
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Code</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Status</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Roles</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Token Balance</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Expires</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border-dark/50">
                {referralCodesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      Loading referral codes...
                    </TableCell>
                  </TableRow>
                ) : filteredReferralCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8 text-center text-text-secondary-dark text-xs">
                      No referral codes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferralCodes.map(code => renderReferralCodeRow(code))
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t border-border-dark flex items-center justify-between bg-surface-dark/50">
              <div className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider">
                Showing {filteredReferralCodes.length} Referral Codes
              </div>
            </div>
          </Card>
        </TabsContent>
       </Tabs>
    </div>
  )
}

