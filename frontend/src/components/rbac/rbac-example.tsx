import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ConditionalRender, 
  PermissionButton, 
  AdminRender, 
  OwnerRender, 
  SellerRender, 
  DeveloperRender 
} from './conditional-render'
import { usePermissions } from '@/hooks/use-permissions'
import { useRBACApi } from '@/hooks/use-rbac-api'

/**
 * Example component demonstrating RBAC usage
 * Shows how to use permission guards, conditional rendering, and API integration
 */
export function RBACExample() {
  const { 
    user, 
    isAdmin, 
    isOwner, 
    isSeller, 
    isDeveloper, 
    hasPermission, 
    canAccessFeature,
    primaryRole,
    roleDisplayName,
    roleColor 
  } = usePermissions()

  const { rbacData, loading, error, fetchRBACData } = useRBACApi()

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>RBAC System Example</CardTitle>
          <CardDescription>
            This component demonstrates various RBAC features and components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">User Information</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge className={roleColor}>
                {roleDisplayName}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Primary Role: {primaryRole}
            </div>
          </div>

          {/* Permission-based Conditional Rendering */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Conditional Rendering Examples</h3>
            
            {/* Admin only content */}
            <AdminRender>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  This content is only visible to admins and owners
                </p>
              </div>
            </AdminRender>

            {/* Owner only content */}
            <OwnerRender>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">
                  This content is only visible to owners
                </p>
              </div>
            </OwnerRender>

            {/* Seller or above content */}
            <SellerRender>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  This content is visible to sellers and above
                </p>
              </div>
            </SellerRender>

            {/* Developer or above content */}
            <DeveloperRender>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  This content is visible to developers and above
                </p>
              </div>
            </DeveloperRender>

            {/* Permission-based content */}
            <ConditionalRender
              permission="users.create"
              fallback={<p className="text-sm text-muted-foreground">You don't have permission to create users</p>}
            >
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  You have permission to create users
                </p>
              </div>
            </ConditionalRender>

            {/* Feature-based content */}
            <ConditionalRender
              feature="users_management"
              fallback={<p className="text-sm text-muted-foreground">You don't have access to user management</p>}
            >
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800">
                  You have access to user management features
                </p>
              </div>
            </ConditionalRender>
          </div>

          {/* Permission-based Buttons */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Permission-based Buttons</h3>
            <div className="flex flex-wrap gap-2">
              <PermissionButton
                permission="users.create"
                variant="default"
                onClick={() => console.log('Create user clicked')}
              >
                Create User
              </PermissionButton>

              <PermissionButton
                permission="users.edit"
                variant="outline"
                onClick={() => console.log('Edit user clicked')}
              >
                Edit User
              </PermissionButton>

              <PermissionButton
                permission="users.delete"
                variant="destructive"
                onClick={() => console.log('Delete user clicked')}
              >
                Delete User
              </PermissionButton>

              <PermissionButton
                roles={['admin', 'owner']}
                variant="secondary"
                onClick={() => console.log('Admin action clicked')}
              >
                Admin Action
              </PermissionButton>

              <PermissionButton
                feature="key_management"
                variant="outline"
                onClick={() => console.log('Key management clicked')}
              >
                Manage Keys
              </PermissionButton>
            </div>
          </div>

          {/* RBAC Data Display */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">RBAC Data</h3>
            {loading && <p className="text-sm text-muted-foreground">Loading RBAC data...</p>}
            {error && <p className="text-sm text-red-600">Error: {error}</p>}
            {rbacData && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Roles:</span> {rbacData.roles.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Permissions:</span> {rbacData.permissions.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">User Roles:</span> {rbacData.user_roles.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">User Permissions:</span> {rbacData.user_permissions.length}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchRBACData}
                >
                  Refresh RBAC Data
                </Button>
              </div>
            )}
          </div>

          {/* Permission Checks */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Permission Checks</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span>Is Admin:</span>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Is Owner:</span>
                <Badge variant={isOwner ? "default" : "secondary"}>
                  {isOwner ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Is Seller:</span>
                <Badge variant={isSeller ? "default" : "secondary"}>
                  {isSeller ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Is Developer:</span>
                <Badge variant={isDeveloper ? "default" : "secondary"}>
                  {isDeveloper ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Can Create Users:</span>
                <Badge variant={hasPermission('users.create') ? "default" : "secondary"}>
                  {hasPermission('users.create') ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Can Access User Management:</span>
                <Badge variant={canAccessFeature('users_management') ? "default" : "secondary"}>
                  {canAccessFeature('users_management') ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
