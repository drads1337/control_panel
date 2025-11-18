
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
  },
  USERS: {
    BASE: '/api/users',
    TOPUP: '/api/users/topup',
    TOKENS: (userId: number) => `/api/users/${userId}/tokens`,
  },
  RBAC: {
    ROLES: '/api/rbac/roles',
    PERMISSIONS: '/api/rbac/permissions',
    USER_ROLES: (userId: number) => `/api/rbac/users/${userId}/roles`,
    USER_PERMISSIONS: (userId: number) => `/api/rbac/users/${userId}/permissions`,
    ROLE_PERMISSIONS: (roleId: number) => `/api/rbac/roles/${roleId}/permissions`,
  },
  GAMES: {
    BASE: '/api/games',
    PRICES: (gameId: number) => `/api/games/${gameId}/prices`,
  },
  KEYS: {
    BASE: '/api/keys',
  },
  FILES: {
    BASE: '/api/files',
  },
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    SEND: '/api/notifications/send',
  },
  WEBHOOKS: {
    BASE: '/api/webhooks',
  },
} as const;
