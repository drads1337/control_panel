import React, { useState } from 'react'
import { 
  Users as UsersIcon, 
  Shield, 
  Search, 
  UserPlus, 
  MoreVertical, 
  X, 
  Info, 
  Copy, 
  Plus, 
  Lock, 
  Users,
  Trash2,
  UserX
} from 'lucide-react'
import { Button } from '@/shared/ui/components/button'
import { Input } from '@/shared/ui/components/input'
import { Badge } from '@/shared/ui/components/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/components/avatar'
import { Switch } from '@/shared/ui/components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select'
import { cn } from '@/shared/lib/utils'

// --- Types ---

type Permission = 'read:users' | 'write:users' | 'ban:users' | 'view:logs' | 'manage:billing' | 'admin:all' | 'manage:roles' | 'view:stats'

interface User {
    id: string
    name: string
    email: string
    role: string
    status: 'active' | 'suspended' | 'pending'
    avatar: string
    
    // RBAC (Specific overrides)
    permissions: Permission[]
    
    // Referral System
    referralCode: string
    referredBy?: string
    referralCount: number
    referralEarnings: string
    
    lastLogin: string
}

interface RoleDef {
    id: string
    name: string
    color: string
    usersCount: number
    description: string
    permissions: Permission[]
    isSystem?: boolean
}

// --- Mock Data ---

const ROLES_DATA: RoleDef[] = [
    { 
        id: 'r_admin', 
        name: 'Admin', 
        color: 'indigo', 
        usersCount: 3, 
        description: 'Full system access with no restrictions. Can manage billing and security.',
        permissions: ['admin:all', 'manage:billing', 'manage:roles', 'view:logs'],
        isSystem: true
    },
    { 
        id: 'r_mod', 
        name: 'Moderator', 
        color: 'purple', 
        usersCount: 5, 
        description: 'Can manage users, view logs, and handle reports. No billing access.',
        permissions: ['read:users', 'ban:users', 'view:logs'],
        isSystem: true
    },
    { 
        id: 'r_cust', 
        name: 'Customer', 
        color: 'emerald', 
        usersCount: 842, 
        description: 'Standard product access. Can manage own profile and subscription.',
        permissions: ['read:users'],
        isSystem: true
    },
    { 
        id: 'r_guest', 
        name: 'Guest', 
        color: 'gray', 
        usersCount: 12, 
        description: 'Read-only access to public resources. Limited API rate limits.',
        permissions: [],
        isSystem: true
    }
]

const ALL_PERMISSIONS: { id: Permission; category: string; description: string }[] = [
    { id: 'admin:all', category: 'System', description: 'Full administrative access to all modules.' },
    { id: 'manage:roles', category: 'System', description: 'Create, edit, and delete system roles.' },
    { id: 'view:logs', category: 'System', description: 'Access to system audit logs and security events.' },
    { id: 'read:users', category: 'Users', description: 'View user profiles and directory.' },
    { id: 'write:users', category: 'Users', description: 'Edit user details and settings.' },
    { id: 'ban:users', category: 'Users', description: 'Ban or suspend user accounts.' },
    { id: 'manage:billing', category: 'Billing', description: 'Access to invoices, refunds, and payment settings.' },
    { id: 'view:stats', category: 'Reporting', description: 'View dashboard analytics and usage stats.' },
]

const USERS_DATA: User[] = [
    {
        id: 'usr_882190',
        name: 'Cameron Williamson',
        email: 'cameron@example.com',
        role: 'Admin',
        status: 'active',
        avatar: 'https://i.pravatar.cc/150?u=11',
        permissions: ['admin:all'],
        referralCode: 'CAM-KING-01',
        referralCount: 154,
        referralEarnings: '$1,240.50',
        lastLogin: '2 mins ago'
    },
    {
        id: 'usr_772100',
        name: 'Wade Warren',
        email: 'wade.warren@gmail.com',
        role: 'Customer',
        status: 'active',
        avatar: 'https://i.pravatar.cc/150?u=14',
        permissions: [],
        referralCode: 'WADE-W-22',
        referralCount: 2,
        referralEarnings: '$15.00',
        lastLogin: '4 hours ago'
    },
    {
        id: 'usr_992111',
        name: 'Esther Howard',
        email: 'esther.h@protomail.com',
        role: 'Moderator',
        status: 'active',
        avatar: 'https://i.pravatar.cc/150?u=22',
        permissions: ['read:users', 'ban:users'],
        referralCode: 'ESTHER-MOD',
        referralCount: 0,
        referralEarnings: '$0.00',
        lastLogin: '1 day ago'
    },
    {
        id: 'usr_110292',
        name: 'Brooklyn Simmons',
        email: 'brooklyn@yahoo.com',
        role: 'Customer',
        status: 'suspended',
        avatar: 'https://i.pravatar.cc/150?u=33',
        permissions: [],
        referralCode: 'BROOK-99',
        referralCount: 12,
        referralEarnings: '$120.00',
        referredBy: 'CAM-KING-01',
        lastLogin: '2 weeks ago'
    },
    {
        id: 'usr_559210',
        name: 'Guy Hawkins',
        email: 'guy.hawk@demo.io',
        role: 'Customer',
        status: 'pending',
        avatar: 'https://i.pravatar.cc/150?u=44',
        permissions: [],
        referralCode: 'GUY-HAWK-88',
        referralCount: 0,
        referralEarnings: '$0.00',
        lastLogin: 'Never'
    }
]

// --- Components ---

const RoleBadge = ({ role }: { role: string }) => {
    const colors: Record<string, string> = {
        'Admin': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        'Moderator': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        'Customer': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        'Guest': 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
    const style = colors[role] || colors['Guest']
    return (
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border', style)}>
            {role}
        </span>
    )
}

const StatusDot = ({ status }: { status: User['status'] }) => {
    const colors = {
        'active': 'bg-emerald-500',
        'suspended': 'bg-red-500',
        'pending': 'bg-amber-500'
    }
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', colors[status])}></div>
            <span className="text-[11px] capitalize text-text-secondary-dark">{status}</span>
        </div>
    )
}

export function UsersPage() {
    const [viewMode, setViewMode] = useState<'directory' | 'rbac'>('directory')
    const [directoryGroup, setDirectoryGroup] = useState<'clients' | 'staff'>('clients')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'rbac' | 'referrals'>('profile')
    
    // RBAC State
    const [selectedRoleId, setSelectedRoleId] = useState<string>(ROLES_DATA[0].id)
    const [rbacTab, setRbacTab] = useState<'permissions' | 'members' | 'settings'>('permissions')

    const selectedRoleData = ROLES_DATA.find(r => r.id === selectedRoleId) || ROLES_DATA[0]

    // Filter logic: Separate Staff (Admin, Moderator) from Clients (Customer, Guest)
    const filteredUsers = USERS_DATA.filter(user => {
        const isStaff = ['Admin', 'Moderator', 'Developer'].includes(user.role)
        return directoryGroup === 'staff' ? isStaff : !isStaff
    })

    // Group permissions
    const groupedPermissions = ALL_PERMISSIONS.reduce((groups, perm) => {
        const category = perm.category
        if (!groups[category]) {
            groups[category] = []
        }
        groups[category].push(perm)
        return groups
    }, {} as Record<string, typeof ALL_PERMISSIONS>)

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-0 overflow-hidden relative bg-background-dark border border-border-dark rounded-sm shadow-sm">
            
            {/* --- TOP TABS --- */}
            <div className="flex items-center px-6 border-b border-border-dark bg-[#12141a] shrink-0 gap-8">
                <button 
                    onClick={() => setViewMode('directory')}
                    className={cn(
                        'py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2',
                        viewMode === 'directory' 
                            ? 'border-primary text-white' 
                            : 'border-transparent text-text-secondary-dark hover:text-white'
                    )}
                >
                    <UsersIcon className="text-base" />
                    User Directory
                </button>
                <button 
                    onClick={() => setViewMode('rbac')}
                    className={cn(
                        'py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2',
                        viewMode === 'rbac' 
                            ? 'border-primary text-white' 
                            : 'border-transparent text-text-secondary-dark hover:text-white'
                    )}
                >
                    <Shield className="text-base" />
                    RBAC & Roles
                </button>
            </div>

            {/* --- VIEW: USER DIRECTORY --- */}
            {viewMode === 'directory' && (
                <div className="flex-1 flex overflow-hidden relative">
                     {/* Directory Table */}
                     <div className={cn('flex-1 flex flex-col transition-all duration-300', selectedUser && 'mr-96')}>
                         {/* Toolbar */}
                        <div className="h-14 border-b border-border-dark bg-surface-dark flex items-center justify-between px-6 shrink-0">
                            <div className="flex items-center gap-6">
                                {/* Clients / Staff Switcher */}
                                <div className="bg-background-dark border border-border-dark p-0.5 rounded-sm flex">
                                    <button 
                                        onClick={() => setDirectoryGroup('clients')}
                                        className={cn(
                                            'px-3 py-1 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all',
                                            directoryGroup === 'clients' 
                                                ? 'bg-primary text-background-dark shadow-sm' 
                                                : 'text-text-secondary-dark hover:text-white'
                                        )}
                                    >
                                        Clients
                                    </button>
                                    <button 
                                        onClick={() => setDirectoryGroup('staff')}
                                        className={cn(
                                            'px-3 py-1 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all',
                                            directoryGroup === 'staff' 
                                                ? 'bg-primary text-background-dark shadow-sm' 
                                                : 'text-text-secondary-dark hover:text-white'
                                        )}
                                    >
                                        Staff
                                    </button>
                                </div>
                                <div className="h-6 w-px bg-border-dark"></div>
                                <div className="relative group">
                                     <Search className="absolute left-3 top-2 text-text-secondary-dark text-sm group-focus-within:text-primary transition-colors" />
                                     <Input 
                                        className="bg-background-dark border border-border-dark rounded-sm pl-9 pr-4 py-1.5 text-xs text-text-primary-dark focus:border-primary outline-none w-56 transition-all placeholder-text-secondary-dark/50" 
                                        placeholder={`Search ${directoryGroup}...`} 
                                     />
            </div>
          </div>
                            <Button className="bg-primary hover:bg-primary-hover text-background-dark px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-glow">
                                <UserPlus className={cn(directoryGroup === 'clients' ? "text-sm" : "text-sm")} /> 
                                Create {directoryGroup === 'clients' ? 'Client' : 'Staff'}
                            </Button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Header */}
                            <div className="grid grid-cols-12 px-6 py-3 bg-[#0F1115] border-b border-border-dark text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest select-none sticky top-0 z-10">
                                <div className="col-span-4">Identity</div>
                                <div className="col-span-2">Role</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-3">{directoryGroup === 'clients' ? 'Referral Code' : 'Access Level'}</div>
                                <div className="col-span-1 text-right">Actions</div>
        </div>
                            
                            {filteredUsers.map(user => (
                                <div 
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={cn(
                                        'grid grid-cols-12 px-6 py-3 border-b border-border-dark/40 items-center cursor-pointer group transition-all hover:bg-white/5',
                                        selectedUser?.id === user.id 
                                            ? 'bg-white/5 border-l-2 border-l-primary' 
                                            : 'border-l-2 border-l-transparent'
                                    )}
                                >
                                    <div className="col-span-4 flex items-center gap-3">
                                        <Avatar className="w-9 h-9 rounded bg-surface-dark border border-border-dark">
                                            <AvatarImage src={user.avatar} alt={user.name} />
                                            <AvatarFallback className="text-xs">{user.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">{user.name}</div>
                                            <div className="text-[10px] text-text-secondary-dark font-mono">{user.email}</div>
                                        </div>
                                    </div>
                                    <div className="col-span-2"><RoleBadge role={user.role} /></div>
                                    <div className="col-span-2"><StatusDot status={user.status} /></div>
                                    <div className="col-span-3">
                                        {directoryGroup === 'clients' ? (
        <div className="flex items-center gap-2">
                                                <div className="px-2 py-1 bg-surface-dark border border-border-dark rounded text-[10px] font-mono text-text-secondary-dark select-all">
                                                    {user.referralCode}
                                                </div>
                                                {user.referralCount > 0 && <span className="text-[10px] text-emerald-400 font-bold">+{user.referralCount}</span>}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-text-secondary-dark font-mono opacity-70">
                                                {user.role === 'Admin' ? 'Level 5 (Full)' : 'Level 2 (Limited)'}
                                            </div>
          )}
        </div>
                                    <div className="col-span-1 text-right">
                                        <Button variant="ghost" size="icon" className="text-text-secondary-dark hover:text-white transition-colors opacity-0 group-hover:opacity-100 h-6 w-6">
                                            <MoreVertical className="text-lg" />
        </Button>
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="p-8 text-center">
                                    <UserX className="text-3xl text-text-secondary-dark opacity-30 mb-2" />
                                    <p className="text-xs text-text-secondary-dark uppercase tracking-wider opacity-60">No {directoryGroup} found</p>
                                </div>
                            )}
                        </div>
                     </div>

                    {/* --- INSPECTOR DRAWER --- */}
                    <div className={cn(
                        'absolute top-0 right-0 h-full w-96 bg-surface-dark border-l border-border-dark shadow-2xl transform transition-transform duration-300 ease-in-out z-20 flex flex-col',
                        selectedUser ? 'translate-x-0' : 'translate-x-full'
                    )}>
                        {selectedUser && (
                            <>
                                <div className="h-14 border-b border-border-dark flex items-center justify-between px-6 bg-[#161920] shrink-0">
                                    <span className="text-sm font-bold text-white uppercase tracking-wider">User Details</span>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="text-text-secondary-dark hover:text-white h-6 w-6">
                                        <X className="text-lg" />
                                    </Button>
                                </div>
                                <div className="flex border-b border-border-dark bg-[#12141a] shrink-0">
                                    {(['profile', 'rbac', 'referrals'] as const).map(tab => (
                                        <button 
                                            key={tab} 
                                            onClick={() => setInspectorTab(tab)} 
                                            className={cn(
                                                'flex-1 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors',
                                                inspectorTab === tab 
                                                    ? 'border-primary text-white bg-white/5' 
                                                    : 'border-transparent text-text-secondary-dark hover:text-white'
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 bg-[#0F1115]">
                                    {inspectorTab === 'profile' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="flex flex-col items-center pb-6 border-b border-border-dark">
                                                <Avatar className="w-24 h-24 rounded-full border-4 border-surface-dark mb-4">
                                                    <AvatarImage src={selectedUser.avatar} alt={selectedUser.name} />
                                                    <AvatarFallback className="text-xl">{selectedUser.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <h2 className="text-xl font-bold text-white mb-1">{selectedUser.name}</h2>
                                                <div className="text-xs text-text-secondary-dark font-mono mb-4">{selectedUser.email}</div>
                                                <Button className="w-full bg-white text-background-dark py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200">
                                                    Edit Profile
        </Button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center py-2 border-b border-border-dark/50">
                                                    <span className="text-[11px] text-text-secondary-dark">Role</span>
                                                    <span className="text-xs font-bold text-white">{selectedUser.role}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-border-dark/50">
                                                    <span className="text-[11px] text-text-secondary-dark">Joined</span>
                                                    <span className="text-xs font-mono text-white">20 Oct 2023</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {inspectorTab === 'rbac' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-sm p-3 flex gap-3 items-start">
                                                <Info className="text-blue-400 text-lg mt-0.5" />
                                                <div className="text-[11px] text-blue-200">
                                                    User permissions are inherited from the <strong>{selectedUser.role}</strong> role.
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-text-secondary-dark mb-2 tracking-wider">Override Role</label>
                                                <Select defaultValue={selectedUser.role}>
                                                    <SelectTrigger className="w-full bg-background-dark border border-border-dark rounded-sm px-3 py-2 text-xs text-white outline-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Admin">Admin</SelectItem>
                                                        <SelectItem value="Moderator">Moderator</SelectItem>
                                                        <SelectItem value="Customer">Customer</SelectItem>
                                                    </SelectContent>
                                                </Select>
          </div>
            </div>
          )}
                                    {inspectorTab === 'referrals' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                             <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-surface-dark border border-border-dark p-3 rounded-sm">
                                                    <div className="text-[10px] text-text-secondary-dark uppercase mb-1">Earned</div>
                                                    <div className="text-lg font-bold text-white font-mono">{selectedUser.referralEarnings}</div>
                                                </div>
                                                <div className="bg-surface-dark border border-border-dark p-3 rounded-sm">
                                                    <div className="text-[10px] text-text-secondary-dark uppercase mb-1">Referred</div>
                                                    <div className="text-lg font-bold text-white font-mono">{selectedUser.referralCount}</div>
          </div>
        </div>
                                            <div className="bg-[#12141a] border border-border-dark p-4 rounded-sm">
                                                <label className="block text-[10px] font-bold uppercase text-text-secondary-dark mb-2 tracking-wider">Referral Code</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-background-dark border border-border-dark rounded-sm px-3 py-2 text-xs font-mono text-primary font-bold flex items-center justify-between">
                                                        {selectedUser.referralCode}
                                                        <Copy className="text-xs cursor-pointer hover:text-primary-hover" />
                                                    </div>
      </div>
    </div>
                        </div>
                                    )}
                    </div>
                                <div className="p-4 border-t border-border-dark bg-[#161920]">
                                    <Button className="w-full bg-primary hover:bg-primary-hover text-background-dark py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all shadow-glow">
                                        Save Changes
                                    </Button>
                    </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- VIEW: RBAC (MASTER-DETAIL) --- */}
            {viewMode === 'rbac' && (
                <div className="flex h-full animate-in fade-in duration-300">
                    
                    {/* Left Sidebar: Role List */}
                    <div className="w-72 border-r border-border-dark flex flex-col bg-[#161920]">
                        {/* Header */}
                        <div className="h-14 border-b border-border-dark flex items-center justify-between px-4 shrink-0">
                            <span className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Defined Roles</span>
                            <Button variant="ghost" size="icon" className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-white transition-colors">
                                <Plus className="text-base" />
                            </Button>
       </div>

                        {/* Search */}
                        <div className="p-3 border-b border-border-dark bg-[#12141a]">
            <div className="relative group">
                                <Search className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-text-secondary-dark text-xs group-focus-within:text-primary transition-colors mt-2" />
                <Input 
                                    className="w-full bg-[#0a0c10] border border-border-dark rounded-sm pl-8 pr-3 py-1.5 text-[10px] text-text-primary-dark focus:border-primary outline-none transition-all placeholder-text-secondary-dark/40" 
                                    placeholder="Filter roles..." 
                />
            </div>
       </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {ROLES_DATA.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={cn(
                                        'w-full text-left px-4 py-4 border-b border-border-dark/50 transition-all flex items-start gap-3 group relative',
                                        selectedRoleId === role.id ? 'bg-[#1F232B]' : 'hover:bg-white/5'
                                    )}
                                >
                                    {selectedRoleId === role.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                                    )}
                                    
                                    <div className={cn(
                                        'mt-0.5 w-8 h-8 rounded flex items-center justify-center text-xs font-bold border',
                                        selectedRoleId === role.id 
                                            ? (role.color === 'indigo' ? 'bg-indigo-500 text-white border-indigo-600' :
                                               role.color === 'purple' ? 'bg-purple-500 text-white border-purple-600' :
                                               role.color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-600' :
                                               'bg-gray-500 text-white border-gray-600')
                                            : (role.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                               role.color === 'purple' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                               role.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                               'bg-gray-500/10 text-gray-400 border-gray-500/20')
                                    )}>
                                        {role.name.charAt(0)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={cn(
                                                'text-xs font-bold',
                                                selectedRoleId === role.id ? 'text-white' : 'text-text-secondary-dark group-hover:text-white'
                                            )}>
                                                {role.name}
                                            </span>
                                            {role.isSystem && (
                                                <div title="System Role">
                                                    <Lock className="text-[10px] text-text-secondary-dark opacity-50" />
                                                </div>
                                            )}
              </div>
                                        <div className="flex items-center gap-2 text-[10px] text-text-secondary-dark opacity-60">
                                            <span>{role.usersCount} Members</span>
                                            <span>•</span>
                                            <span>{role.permissions.length} perms</span>
              </div>
            </div>
                                </button>
                            ))}
              </div>
            </div>

                    {/* Main Content: Role Editor */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#0F1115]">
                        
                        {/* Role Header */}
                        <div className="h-40 border-b border-border-dark bg-[#12141a] px-8 flex flex-col justify-center shrink-0">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-5">
                                    <div className={cn(
                                        'w-16 h-16 rounded shadow-lg flex items-center justify-center text-3xl font-display text-white',
                                        selectedRoleData.color === 'indigo' ? 'bg-indigo-500' :
                                        selectedRoleData.color === 'purple' ? 'bg-purple-500' :
                                        selectedRoleData.color === 'emerald' ? 'bg-emerald-500' :
                                        'bg-gray-500'
                                    )}>
                                        {selectedRoleData.name.charAt(0)}
                                    </div>
          <div>
                                        <h2 className="text-2xl font-bold text-white mb-1 font-display flex items-center gap-3">
                                            {selectedRoleData.name}
                                            {selectedRoleData.isSystem && (
                                                <Badge variant="outline" className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-background-dark border border-border-dark text-text-secondary-dark">
                                                    System Default
                                                </Badge>
                                            )}
                                        </h2>
                                        <p className="text-sm text-text-secondary-dark max-w-xl">{selectedRoleData.description}</p>
                </div>
              </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="px-4 py-2 bg-background-dark border border-border-dark hover:border-text-secondary-dark/50 rounded-sm text-xs font-bold text-text-secondary-dark hover:text-white uppercase tracking-wider transition-all">
                                        Duplicate
                                    </Button>
                                    <Button className="px-4 py-2 bg-primary hover:bg-primary-hover text-background-dark rounded-sm text-xs font-bold uppercase tracking-wider transition-all shadow-glow">
                                        Save Changes
                                    </Button>
                  </div>
                  </div>
                        </div>

                        {/* Tabs */}
                        <div className="px-8 border-b border-border-dark bg-[#161920] flex items-center gap-8 shrink-0">
                            {(['permissions', 'members', 'settings'] as const).map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setRbacTab(tab)}
                                    className={cn(
                                        'py-4 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors',
                                        rbacTab === tab 
                                            ? 'border-primary text-white' 
                                            : 'border-transparent text-text-secondary-dark hover:text-white'
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {rbacTab === 'permissions' && (
                                <div className="max-w-5xl space-y-8">
                                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                                        <div key={category} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <h3 className="text-xs font-bold text-text-secondary-dark uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-primary"></span>
                                                {category} Access
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {perms.map(perm => {
                                                    const isEnabled = selectedRoleData.permissions.includes(perm.id)
                                                    return (
                                                        <div 
                                                            key={perm.id} 
                                                            className={cn(
                                                                'flex items-start justify-between p-4 rounded-sm border transition-all cursor-pointer group',
                                                                isEnabled 
                                                                    ? 'bg-surface-dark border-border-dark shadow-sm' 
                                                                    : 'bg-transparent border-border-dark/40 opacity-70 hover:opacity-100 hover:bg-surface-dark/30'
                                                            )}
                                                            onClick={() => {
                                                                // Toggle permission logic here
                                                            }}
                                                        >
                                                            <div className="pr-4">
                                                                <div className={cn(
                                                                    'text-sm font-bold mb-1',
                                                                    isEnabled ? 'text-white' : 'text-text-secondary-dark group-hover:text-white'
                                                                )}>
                                                                    {perm.id.split(':')[0]} <span className="text-text-secondary-dark opacity-60">/</span> {perm.id.split(':')[1]}
                                                                </div>
                                                                <div className="text-[11px] text-text-secondary-dark leading-relaxed">
                                                                    {perm.description}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Toggle Switch */}
                                                            <Switch 
                                                                checked={isEnabled}
                                                                onCheckedChange={() => {
                                                                    // Toggle permission logic here
                                                                }}
                                                                className={cn(
                                                                    'mt-1',
                                                                    isEnabled ? 'bg-primary' : 'bg-background-dark border border-border-dark'
                                                                )}
                                                            />
                                                        </div>
                                                    )
                                                })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                            {rbacTab === 'members' && (
                                <div className="text-center py-12 border border-dashed border-border-dark rounded bg-surface-dark/10">
                                    <Users className="text-4xl text-text-secondary-dark mb-4 opacity-30" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Member Management</h3>
                                    <p className="text-xs text-text-secondary-dark">Manage the {selectedRoleData.usersCount} users assigned to this role.</p>
                                </div>
                            )}

                             {rbacTab === 'settings' && (
                                <div className="max-w-xl space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-text-secondary-dark mb-2 tracking-wider">Role Name</label>
                                        <Input 
                                            className="w-full bg-background-dark border border-border-dark rounded-sm px-4 py-2 text-sm text-white focus:border-primary outline-none" 
                                            defaultValue={selectedRoleData.name} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-text-secondary-dark mb-2 tracking-wider">Description</label>
                                        <textarea 
                                            className="w-full bg-background-dark border border-border-dark rounded-sm px-4 py-2 text-sm text-white focus:border-primary outline-none h-24 resize-none" 
                                            defaultValue={selectedRoleData.description} 
                                        />
              </div>
                                    <div className="pt-6 border-t border-border-dark">
                                        <Button variant="ghost" className="text-red-500 text-xs font-bold uppercase tracking-wider hover:text-red-400 flex items-center gap-2 p-0 h-auto">
                                            <Trash2 className="text-sm" /> Delete Role
                                        </Button>
                </div>
              </div>
                            )}
          </div>
              </div>
            </div>
            )}
    </div>
  )
}
