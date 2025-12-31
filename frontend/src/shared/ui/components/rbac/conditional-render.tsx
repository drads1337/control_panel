import React from 'react';
import { usePermissions } from '@/shared/hooks/use-permissions';

interface ConditionalRenderProps {
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  feature?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ConditionalRender({
  permission,
  permissions,
  role,
  roles,
  feature,
  fallback = null,
  children
}: ConditionalRenderProps) {
  const { hasPermission, hasAnyPermission, hasRole, hasAnyRole, canAccessFeature } = usePermissions();

  // Check permissions
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (permissions && !hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }

  // Check roles
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  if (roles && !hasAnyRole(roles)) {
    return <>{fallback}</>;
  }

  // Check feature access
  if (feature && !canAccessFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission?: string;
  permissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionButton({
  permission,
  permissions,
  fallback = null,
  children,
  ...props
}: PermissionButtonProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (permissions && !hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }

  return <button {...props}>{children}</button>;
}

interface PermissionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  permission?: string;
  permissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionLink({
  permission,
  permissions,
  fallback = null,
  children,
  ...props
}: PermissionLinkProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (permissions && !hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }

  return <a {...props}>{children}</a>;
}

interface RoleRenderProps {
  role?: string;
  roles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleRender({ role, roles, fallback = null, children }: RoleRenderProps) {
  const { hasRole, hasAnyRole } = usePermissions();

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  if (roles && !hasAnyRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function AdminRender({ fallback = null, children }: { fallback?: React.ReactNode; children: React.ReactNode }) {
  const { isAdmin } = usePermissions();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
}

export function OwnerRender({ fallback = null, children }: { fallback?: React.ReactNode; children: React.ReactNode }) {
  const { isOwner } = usePermissions();
  return isOwner ? <>{children}</> : <>{fallback}</>;
}

export function SellerRender({ fallback = null, children }: { fallback?: React.ReactNode; children: React.ReactNode }) {
  const { isSeller } = usePermissions();
  return isSeller ? <>{children}</> : <>{fallback}</>;
}

export function DeveloperRender({ fallback = null, children }: { fallback?: React.ReactNode; children: React.ReactNode }) {
  const { isDeveloper } = usePermissions();
  return isDeveloper ? <>{children}</> : <>{fallback}</>;
}








