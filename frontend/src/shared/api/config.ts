import type { User } from '@/entities/user';
import type { Project } from '@/entities/project';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
import type { Session } from '@/entities/session';
import type { Log } from '@/entities/log';

export const API_ENDPOINTS = {

  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  REGISTER_WITH_INVITE: '/api/auth/register-with-invite',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',
  CLASSIC_CONNECT: '/api/classic_connect',
  LOGOUT: '/api/auth/logout',

  ME: '/api/users/me',
  PROFILE: '/api/users/profile',
  CHANGE_PASSWORD: '/api/users/change_password',
  AVATAR: '/api/users/avatar',
  USERS: '/api/users',
  USERS_ADD: '/api/users/add',
  USERS_STATS: '/api/users/stats',
  USERS_REFCODES: '/api/users/refcodes',
  USERS_REFCODES_DELETE_UNUSED: '/api/users/refcodes/delete-unused',

  PROJECTS: '/api/projects',
  PROJECT_CODES: '/api/project-codes',
  PROJECT_CODES_LATEST: '/api/project-codes/latest',
  PROJECT_CODES_DELETE_UNUSED: '/api/project-codes/delete-unused',

  INVITE_CODE_CHECK: '/api/invite-code/check',
  REFERRAL_CODE_INFO: '/api/referral_code_info',
  VALIDATE_INVITE_CODE: '/api/validate_invite_code',

  FILES: '/api/files',
  FILE_STATS: '/api/files/stats',
  PRODUCT_FILES: '/api/files/product-files',
  FOLDERS: '/api/files/folders',
  PRODUCT_FILE_STATS: '/api/files/stats/product',

  // Universal terminology endpoints (new)
  // These are the primary endpoints using consistent terminology
  PRODUCTS: '/api/products',
  PRODUCTS_COUNT: '/api/products/count',
  PRODUCTS_AVAILABLE_FOR_ASSIGNMENT: '/api/products/available-for-assignment',
  AGENTS: '/api/agents',
  AGENTS_AVAILABLE_PRODUCTS: '/api/agents/available-products',
  AGENTS_STATS: '/api/agents/stats',

  KEYS: '/api/keys',
  KEYS_CUSTOM: '/api/keys/custom',
  KEYS_BULK: '/api/keys/bulk',
  KEYS_AGENT: '/api/keys/agent',
  KEYS_AGENT_CUSTOM: '/api/keys/agent/custom',
  KEYS_BULK_AGENT: '/api/keys/bulk/agent',
  KEYS_VALIDATE: '/api/keys/validate',
  KEYS_STATS: '/api/keys/stats',
  KEYS_COUNT_BY_FILTERS: '/api/keys/countByFilters',
  KEYS_BULK_DELETE_BY_FILTERS: '/api/keys/bulk/deleteByFilters',
  KEYS_BULK_RESET_BY_FILTERS: '/api/keys/bulk/resetByFilters',
  KEYS_BULK_EXTEND_BY_FILTERS: '/api/keys/bulk/extendByFilters',
  KEYS_BULK_PAUSE: '/api/keys/bulk/pause',
  KEYS_BULK_PAUSE_BY_PRODUCT: '/api/keys/bulk/pause/by_product',
  KEYS_BULK_ACTIVATE: '/api/keys/bulk/activate',
  KEYS_BULK_ACTIVATE_BY_PRODUCT: '/api/keys/bulk/activate/by_product',
  KEYS_BULK_DELETE: '/api/keys/bulk/delete',
  KEYS_BULK_DELETE_BY_PRODUCT: '/api/keys/bulk/delete/by_product',
  KEYS_BULK_ADD_HOURS: '/api/keys/bulk/addHours',
  KEYS_BULK_ADD_HOURS_BY_PRODUCT: '/api/keys/bulk/addHours/by_product',
  KEYS_BULK_AGENT_PAUSE: '/api/keys/bulk/agent/pause',
  KEYS_BULK_AGENT_ACTIVATE: '/api/keys/bulk/agent/activate',
  KEYS_BULK_AGENT_DELETE: '/api/keys/bulk/agent/delete',
  KEYS_BULK_AGENT_ADD_HOURS: '/api/keys/bulk/agent/addHours',

  SESSIONS: '/api/sessions',
  SESSIONS_STATS: '/api/sessions/stats',
  SESSIONS_REALTIME: '/api/sessions/realtime',
  SESSIONS_BULK_TERMINATE: '/api/sessions/bulk/terminate',

  LOGS: '/api/logs',
  LOGS_STATS: '/api/logs/stats',
  LOGS_CONNECTS: '/api/logs/connects',
  LOGS_CONNECTS_STATS: '/api/logs/connects/stats',
  LOGS_SEARCH: '/api/logs/search',
  LOGS_REALTIME: '/api/logs/realtime',
  LOGS_EXPORT: '/api/logs/export',
  LOGS_CLEANUP: '/api/logs/cleanup',

  USERS_SEARCH: '/api/users/search',
  KEYS_SEARCH: '/api/keys/search',

  PROFILE_ACTIVITY: '/api/profile/activity',
  PROFILE_ACTIVITY_STATS: '/api/profile/activity/stats',

  SETTINGS: '/api/settings',
  SETTINGS_KEYS: '/api/settings/keys',
  SETTINGS_REGENERATE_MASTER_KEY: '/api/settings/regenerate-master-key',

  NOTIFICATIONS: '/api/notifications',
  NOTIFICATIONS_PRODUCT_UPDATE: '/api/notifications/product-update',
  NOTIFICATIONS_PRODUCTS: '/api/notifications/products',

  CHANGELOG_PRODUCTS: '/api/changelog/products',
  CHANGELOG_CHANGELOG: '/api/changelog/changelog',

  DASHBOARD_API_METRICS: '/api/dashboard/api-metrics',
  DASHBOARD_STATS: '/api/dashboard/stats',
  DASHBOARD_COUNTRIES_MAP: '/api/dashboard/countries-map',
  DASHBOARD_MAP_REQUESTS: '/api/dashboard/map-requests',

  WEBHOOKS: '/api/webhooks',
  WEBHOOKS_STATS: '/api/webhooks/stats',
  WEBHOOKS_EVENTS: '/api/webhooks/events',
  WEBHOOKS_TEST: '/api/webhooks/test',
  WEBHOOKS_TRIGGER: '/api/webhooks/trigger',
  WEBHOOKS_TEST_TRIGGER: '/api/webhooks/test-trigger',

  NAVIGATION: '/api/rbac/navigation',

  REMOTE_CONTROL_CATEGORIES: '/api/remote-control/categories',
  REMOTE_CONTROL_FEATURES: '/api/remote-control/features',
  REMOTE_CONTROL_STATS: '/api/remote-control/stats',
} as const

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS]
