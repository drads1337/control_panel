/**
 * Role and permission related constants
 */

export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  CLIENT: 'client',
} as const;

export const PERMISSION_CATEGORIES = {
  GAMES: 'games',
  KEYS: 'keys',
  USERS: 'users',
  FILES: 'files',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  RBAC: 'rbac',
  SECURITY: 'security',
} as const;

