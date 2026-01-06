import type { User } from '@/entities/user';

/**
 * Check if a user is an admin
 * Checks both roles array and rbac_roles array
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;

  // Check roles array
  const roles = user.roles || [];
  if (roles.some(role => ['admin', 'administrator'].includes(role.toLowerCase()))) {
    return true;
  }

  // Check rbac_roles array
  const rbacRoles = user.rbac_roles || [];
  if (rbacRoles.length > 0) {
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase());
    if (roleNames.some(name => ['admin', 'administrator'].includes(name))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a user is an owner
 * Checks both roles array and rbac_roles array
 */
export function isOwner(user: User | null | undefined): boolean {
  if (!user) return false;

  // Check roles array
  const roles = user.roles || [];
  if (roles.some(role => role.toLowerCase() === 'owner')) {
    return true;
  }

  // Check rbac_roles array
  const rbacRoles = user.rbac_roles || [];
  if (rbacRoles.length > 0) {
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase());
    if (roleNames.some(name => name === 'owner')) {
      return true;
    }
  }

  return false;
}

