import type { User } from '@/entities/user';
import type { Project } from '@/entities/project';
import type { Game } from '@/entities/game';
import type { Loader } from '@/entities/loader';
import type { Session } from '@/entities/session';
import type { Log } from '@/entities/log';
// API Endpoints Configuration
export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  
  // User endpoints
  ME: '/api/users/me',
  PROFILE: '/api/users/profile',
  CHANGE_PASSWORD: '/api/users/change_password',
  AVATAR: '/api/users/avatar',
  USERS: '/api/users',
  USERS_ADD: '/api/users/add',
  USERS_STATS: '/api/users/stats',
  USERS_REFCODES: '/api/users/refcodes',
  USERS_REFCODES_DELETE_UNUSED: '/api/users/refcodes/delete-unused',
  
  // Project endpoints
  PROJECTS: '/api/projects',
  PROJECT_CODES: '/api/project-codes',
  PROJECT_CODES_LATEST: '/api/project-codes/latest',
  PROJECT_CODES_DELETE_UNUSED: '/api/project-codes/delete-unused',
  
  // Invite code endpoints
  INVITE_CODE_CHECK: '/api/invite-code/check',
  REFERRAL_CODE_INFO: '/api/referral_code_info',
  VALIDATE_INVITE_CODE: '/api/validate_invite_code',
  
  // File endpoints
  FILES: '/api/files',
  FILE_STATS: '/api/files/stats',
  GAME_FILES: '/api/files/game-files',
  FOLDERS: '/api/files/folders',
  GAME_FILE_STATS: '/api/files/stats/game',
  
  // Game endpoints
  GAMES: '/api/games',
  GAMES_AVAILABLE_FOR_ASSIGNMENT: '/api/games/available-for-assignment',
  GAMES_CLASSIC_USERS: '/api/clients', // Classic users endpoint
  
  // Loader endpoints
  LOADERS: '/api/loaders',
  LOADERS_AVAILABLE_GAMES: '/api/loaders/available-games',
  LOADERS_STATS: '/api/loaders/stats',
  
  // Key endpoints
  KEYS: '/api/keys',
  KEYS_CUSTOM: '/api/keys/custom',
  KEYS_BULK: '/api/keys/bulk',
  KEYS_LOADER: '/api/keys/loader',
  KEYS_LOADER_CUSTOM: '/api/keys/loader/custom',
  KEYS_BULK_LOADER: '/api/keys/bulk/loader',
  KEYS_VALIDATE: '/api/keys/validate',
  KEYS_STATS: '/api/keys/stats',
  KEYS_COUNT_BY_FILTERS: '/api/keys/countByFilters',
  KEYS_BULK_DELETE_BY_FILTERS: '/api/keys/bulk/deleteByFilters',
  KEYS_BULK_RESET_BY_FILTERS: '/api/keys/bulk/resetByFilters',
  KEYS_BULK_EXTEND_BY_FILTERS: '/api/keys/bulk/extendByFilters',
  KEYS_BULK_PAUSE: '/api/keys/bulk/pause',
  KEYS_BULK_ACTIVATE: '/api/keys/bulk/activate',
  KEYS_BULK_DELETE: '/api/keys/bulk/delete',
  KEYS_BULK_ADD_HOURS: '/api/keys/bulk/addHours',
  KEYS_BULK_LOADER_PAUSE: '/api/keys/bulk/loader/pause',
  KEYS_BULK_LOADER_ACTIVATE: '/api/keys/bulk/loader/activate',
  KEYS_BULK_LOADER_DELETE: '/api/keys/bulk/loader/delete',
  KEYS_BULK_LOADER_ADD_HOURS: '/api/keys/bulk/loader/addHours',
  
  // Session endpoints
  SESSIONS: '/api/sessions',
  SESSIONS_STATS: '/api/sessions/stats',
  SESSIONS_REALTIME: '/api/sessions/realtime',
  SESSIONS_BULK_TERMINATE: '/api/sessions/bulk/terminate',
  
  // Log endpoints
  LOGS: '/api/logs',
  LOGS_STATS: '/api/logs/stats',
  LOGS_CONNECTS: '/api/logs/connects',
  LOGS_CONNECTS_STATS: '/api/logs/connects/stats',
  LOGS_SEARCH: '/api/logs/search',
  LOGS_REALTIME: '/api/logs/realtime',
  LOGS_EXPORT: '/api/logs/export',
  LOGS_CLEANUP: '/api/logs/cleanup',
  
  // Profile endpoints
  PROFILE_ACTIVITY: '/api/profile/activity',
  PROFILE_ACTIVITY_STATS: '/api/profile/activity/stats',
  
  // Settings endpoints
  SETTINGS: '/api/settings',
  SETTINGS_KEYS: '/api/settings/keys',
  SETTINGS_REGENERATE_MASTER_KEY: '/api/settings/regenerate-master-key',
  
  // Notification endpoints
  NOTIFICATIONS_GAME_UPDATE: '/api/notifications/game-update',
  NOTIFICATIONS_GAMES: '/api/notifications/games',
  
  // Changelog endpoints
  CHANGELOG_GAMES: '/api/changelog/games',
  CHANGELOG_CHANGELOG: '/api/changelog/changelog',
  
  // Dashboard endpoints
  DASHBOARD_API_METRICS: '/api/dashboard/api-metrics',
  DASHBOARD_STATS: '/api/dashboard/stats',
  
  // Webhook endpoints
  WEBHOOKS: '/api/webhooks',
  WEBHOOKS_STATS: '/api/webhooks/stats',
  WEBHOOKS_EVENTS: '/api/webhooks/events',
  WEBHOOKS_TEST: '/api/webhooks/test',
  WEBHOOKS_TRIGGER: '/api/webhooks/trigger',
  WEBHOOKS_TEST_TRIGGER: '/api/webhooks/test-trigger',
  
  // Navigation endpoints
  NAVIGATION: '/api/rbac/navigation',
} as const

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS]
