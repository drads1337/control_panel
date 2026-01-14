"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import type { User } from "@/entities/user"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { useAuthContext } from "@/app/providers/auth-provider"
import { useUsersQuery } from "@/entities/user"
import { usePermissions } from "@/shared/hooks/use-permissions"
import { AccessDenied } from "@/shared/ui/components"
import { authService } from "@/shared/api/auth-service"
import UsersStats from "./components/UsersStats"
import EmployeesTab from "./components/EmployeesTab"
import ClientsTab from "./components/ClientsTab"
import RBACTab from "./components/RBACTab"
import ReferralsTab from "./components/ReferralsTab"

export function UsersPage() {
  const { user: contextUser, isInitialized, isAuthenticated } = useAuthContext()
  
  // Try to get user from cache if context user is not available
  const [cachedUser, setCachedUser] = useState<User | null>(null)
  
  useEffect(() => {
    if (!contextUser) {
      // Try to get from cache
      try {
        const cached = authService.getCachedUserFromMemory()
        if (cached) {
          setCachedUser(cached)
        }
      } catch (e) {
        // Cache not available
      }
    } else {
      setCachedUser(null)
    }
  }, [contextUser])
  
  // Use context user if available, otherwise try cached user
  const user = contextUser || cachedUser
  
  const {
    users,
    total,
    loading,
    error,
    statsLoading,
    currentPage,
    perPage,
    deleteUser,
    setPage,
    setPerPage,
    setRoles,
    refetch,
  } = useUsersQuery()

  const [activeTab, setActiveTab] = useState("employees")

  const lastFetchParamsRef = useRef<{
    roles?: string[]
    page?: number
    per_page?: number
    search?: string
    role?: string
    project_id?: number
  }>({})

  const fetchUsersWithTracking = useCallback(
    async (params?: {
      roles?: string[]
      page?: number
      per_page?: number
      search?: string
      role?: string
      project_id?: number
    }) => {
      const fetchParams = {
        ...lastFetchParamsRef.current,
        ...(params || {}),
        page: params?.page ?? currentPage,
        per_page: params?.per_page ?? perPage,
      }

      lastFetchParamsRef.current = { ...fetchParams }

      if (params?.page !== undefined) {
        setPage(params.page)
      }
      if (params?.per_page !== undefined) {
        setPerPage(params.per_page)
      }
      if (params?.roles !== undefined) {
        setRoles(params.roles)
      }

      return refetch()
    },
    [setPage, setPerPage, setRoles, refetch, currentPage, perPage]
  )

  const { hasPermission } = usePermissions()
  
  const canViewEmployees = hasPermission("employees.view")
  const canViewClients = hasPermission("clients.view")
  const canViewRbac = hasPermission("rbac.view")
  const canViewReferrals = hasPermission("referrals.view")
  const canViewUsers = canViewEmployees || canViewClients

  const availableTabs = useMemo(() => {
    const tabs: Array<{
      value: string
      label: string
    }> = []
    if (canViewEmployees) {
      tabs.push({
        value: "employees",
        label: "Team",
      })
    }
    if (canViewClients) {
      tabs.push({
        value: "clients",
        label: "Clients",
      })
    }
    if (canViewRbac) {
      tabs.push({
        value: "rbac",
        label: "Roles",
      })
    }
    if (canViewReferrals) {
      tabs.push({
        value: "referrals",
        label: "Invites",
      })
    }
    return tabs
  }, [canViewEmployees, canViewClients, canViewRbac, canViewReferrals])

  useEffect(() => {
    if (
      availableTabs.length > 0 &&
      !availableTabs.some((tab) => tab.value === activeTab)
    ) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs])

  const employeeRolesFilter = useMemo(
    () => ["admin", "seller", "moderator"],
    []
  )

  useEffect(() => {
    if (isInitialized && user && canViewEmployees) {
      setRoles(employeeRolesFilter)
    }
  }, [isInitialized, user, canViewEmployees, setRoles, employeeRolesFilter])

  const userStats = useMemo(
    () => ({
      total: total || 0,
      active: users.length,
      withKeys: users.filter((u) => (u.keys_count || 0) > 0).length,
      admins: users.filter(
        (u) =>
          u.roles?.includes("admin") || u.roles?.includes("owner")
      ).length,
    }),
    [users, total]
  )

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
  }

  if (!canViewUsers) {
    // Get all role names for debugging - check all possible sources
    const allRoles: string[] = []
    
    // Check roles array
    if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      allRoles.push(...user.roles.map(r => String(r)))
    }
    
    // Check rbac_roles array
    if (user?.rbac_roles && Array.isArray(user.rbac_roles) && user.rbac_roles.length > 0) {
      const rbacRoleNames = user.rbac_roles
        .map((r: string | { name?: string }) => {
          if (typeof r === 'string') return r
          if (r && typeof r === 'object' && 'name' in r) return String(r.name)
          return null
        })
        .filter((name: string | null): name is string => name !== null && name !== '')
      allRoles.push(...rbacRoleNames)
    }
    
    // Check legacy role field
    if (user && 'role' in user && user.role) {
      const legacyRole = String(user.role)
      if (!allRoles.includes(legacyRole)) {
        allRoles.push(legacyRole)
      }
    }
    
    // Check is_admin flag
    if (user && 'is_admin' in user && user.is_admin === true) {
      if (!allRoles.includes('admin')) {
        allRoles.push('admin')
      }
    }
    
    // Debug info
    const debugInfo = user ? {
      hasUser: true,
      userId: user.id,
      username: user.username,
      roles: user.roles,
      rbac_roles: user.rbac_roles,
      role: (user as any).role,
      is_admin: (user as any).is_admin,
      permissions: user.permissions,
      allRolesFound: allRoles,
      requiredPermissions: 'employees.view or clients.view'
    } : { hasUser: false }
    
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
            <AccessDenied
              isAuthenticated={isAuthenticated}
              hasAccess={false}
              user={user}
              noPermissionMessage="You don't have permission to view users."
              helpText="Required permissions: employees.view or clients.view"
              showDebugInfo={true}
              debugInfo={debugInfo}
              minHeight="min-h-[400px]"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
              Users
            </h1>
            <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Manage team members, clients, roles, and referral codes.
            </p>
          </div>
          <UsersStats stats={userStats} loading={statsLoading} />
          {availableTabs.length > 0 && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full flex-col justify-start gap-4"
            >
              <div className="flex items-center justify-between px-4 lg:px-6">
                <Label htmlFor="view-selector" className="sr-only">
                  View
                </Label>
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger
                    className="flex w-fit h-7 text-xs @4xl/main:hidden"
                    size="sm"
                    id="view-selector"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {availableTabs.map((tab) => (
                      <SelectItem key={tab.value} value={tab.value} className="text-xs">
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
                  {availableTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {canViewEmployees && (
                <TabsContent
                  value="employees"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <EmployeesTab
                    fetchUsersWithTracking={fetchUsersWithTracking}
                    currentPage={currentPage}
                    perPage={perPage}
                    users={users}
                    loading={loading}
                    error={error}
                    total={total}
                    deleteExistingUser={deleteUser}
                    employeeRolesFilter={employeeRolesFilter}
                  />
                </TabsContent>
              )}
              {canViewClients && (
                <TabsContent
                  value="clients"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ClientsTab />
                </TabsContent>
              )}
              {canViewRbac && (
                <TabsContent
                  value="rbac"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <RBACTab />
                </TabsContent>
              )}
              {canViewReferrals && (
                <TabsContent
                  value="referrals"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ReferralsTab />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}
