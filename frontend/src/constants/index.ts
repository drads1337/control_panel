// Constants for statuses
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  PENDING: 'pending'
} as const;

// Constants for user roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator',
  SELLER: 'seller',
  DEVELOPER: 'developer',
  CUSTOM: 'custom'
} as const;

// Constants for log levels
export const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  DEBUG: 'debug'
} as const;

// Constants for actions
export const ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  DOWNLOAD: 'download',
  UPLOAD: 'upload'
} as const;

// Constants for key types
export const KEY_TYPES = {
  STANDARD: 'standard',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
} as const;

// Constants for key statuses
export const KEY_STATUS = {
  ACTIVE: 1,
  BLOCKED: 0,
  PAUSED: 3,
  EXPIRED: 2
} as const;

// Constants for pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 25, 50, 100]
} as const;

// Constants for filters
export const FILTERS = {
  ALL: 'all',
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year'
} as const;

// Constants for themes
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
} as const;

// Constants for languages
export const LANGUAGES = {
  EN: 'en',
  RU: 'ru'
} as const;

// Constants for API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/login',
    REGISTER: '/api/register',
    ME: '/api/me',
    LOGOUT: '/api/logout'
  },
  USERS: {
    LIST: '/api/users',
    CREATE: '/api/users',
    UPDATE: '/api/users/:id',
    DELETE: '/api/users/:id',
    PROFILE: '/api/users/profile'
  },
  KEYS: {
    LIST: '/api/keys',
    CREATE: '/api/keys',
    UPDATE: '/api/keys/:id',
    DELETE: '/api/keys/:id',
    REGENERATE: '/api/keys/:id/regenerate'
  },
  LOGS: {
    LIST: '/api/logs',
    DOWNLOAD: '/api/logs/download',
    CLEAR: '/api/logs/clear'
  },
  DEVICES: {
    LIST: '/api/devices',
    CREATE: '/api/devices',
    UPDATE: '/api/devices/:id',
    DELETE: '/api/devices/:id'
  }
} as const;

// Base URL for API
export const API_BASE_URL = '';

// Constants for messages
export const MESSAGES = {
  SUCCESS: {
    CREATED: 'Record successfully created',
    UPDATED: 'Record successfully updated',
    DELETED: 'Record successfully deleted',
    SAVED: 'Changes saved',
    LOGIN: 'Successfully logged in',
    LOGOUT: 'Successfully logged out'
  },
  ERROR: {
    CREATED: 'Error creating record',
    UPDATED: 'Error updating record',
    DELETED: 'Error deleting record',
    LOADING: 'Error loading data',
    NETWORK: 'Network error',
    VALIDATION: 'Validation error',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Access denied',
    NOT_FOUND: 'Record not found'
  },
  WARNING: {
    DELETE_CONFIRM: 'Are you sure you want to delete this record?',
    UNSAVED_CHANGES: 'You have unsaved changes',
    SESSION_EXPIRED: 'Session expired'
  },
  INFO: {
    LOADING: 'Loading...',
    NO_DATA: 'No data to display',
    SEARCH_NO_RESULTS: 'Nothing found for your query'
  }
} as const;

// Constants for validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8, // Match backend default
  USERNAME_MIN_LENGTH: 3,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/
} as const;

// Constants for date formats
export const DATE_FORMATS = {
  DISPLAY: 'DD.MM.YYYY HH:mm',
  API: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'DD.MM.YYYY',
  TIME_ONLY: 'HH:mm'
} as const;

// Constants for file sizes
export const FILE_SIZES = {
  MAX_AVATAR: 5 * 1024 * 1024, // 5MB
  MAX_DOCUMENT: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE: 2 * 1024 * 1024 // 2MB
} as const;

// Constants for file types
export const FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEET: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
} as const;

// Constants for colors
export const COLORS = {
  PRIMARY: '#7F5AF0',
  SECONDARY: '#2CB67D',
  SUCCESS: '#2CB67D',
  WARNING: '#FF8906',
  ERROR: '#F25F4C',
  INFO: '#3DA9FC'
} as const;

// Constants for animations
export const ANIMATIONS = {
  DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },
  EASING: {
    EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
    EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
    EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
} as const;

// Constants for breakpoints
export const BREAKPOINTS = {
  XS: 0,
  SM: 600,
  MD: 900,
  LG: 1200,
  XL: 1536
} as const;

// Constants for z-index
export const Z_INDEX = {
  DRAWER: 1200,
  APP_BAR: 1100,
  MODAL: 1300,
  TOOLTIP: 1500,
  SNACKBAR: 1400
} as const;

// Constants for permissions
export const PERMISSION_CATEGORIES = {
  USERS: {
    id: 'users',
    name: 'Users',
    description: 'User management permissions',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete']
  },
  PROJECTS: {
    id: 'projects',
    name: 'Projects',
    description: 'Project management permissions',
    permissions: ['projects.view', 'projects.create', 'projects.edit', 'projects.delete']
  },
  KEYS: {
    id: 'keys',
    name: 'License Keys',
    description: 'License key management permissions',
    permissions: ['keys.view', 'keys.create', 'keys.edit', 'keys.delete']
  },
  GAMES: {
    id: 'games',
    name: 'Games',
    description: 'Game management permissions',
    permissions: ['games.view', 'games.create', 'games.edit', 'games.delete']
  },
  LOGS: {
    id: 'logs',
    name: 'Logs',
    description: 'Log viewing permissions',
    permissions: ['logs.view', 'logs.download', 'logs.clear']
  },
  SETTINGS: {
    id: 'settings',
    name: 'Settings',
    description: 'System settings permissions',
    permissions: ['settings.view', 'settings.edit']
  }
} as const;
