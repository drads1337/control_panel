/**
 * Shared hooks - UI utilities and common hooks
 * These hooks are domain-agnostic and can be used across the entire application
 */

export { useAuth } from './use-auth'
export { useDebounce } from './use-debounce'
export { useIsMobile } from './use-mobile'
export { useIsMac } from './use-is-mac'
export { useSelection } from './use-selection'
export type { UseSelectionOptions, UseSelectionReturn } from './use-selection'

// Mutation and query helpers
export { useMutationWithCache } from './use-mutation-helpers'
export type { CreateMutationOptions } from './use-mutation-helpers'

// Pagination
export { usePaginatedResource } from './use-paginated-resource'
export type {
  PaginatedData,
  PaginationParams,
  UsePaginatedResourceOptions,
  UsePaginatedResourceReturn,
} from './use-paginated-resource'

// Permissions
export {
  usePermissions,
  usePermissionCheck,
  usePermissionChecks,
  useRoleCheck,
  useFeatureAccess,
  useUserManagement,
} from './use-permissions'

// Performance and metrics
export { usePerformanceDetection } from './use-performance-detection'
export { useApiMetrics, apiMetricsKeys } from './use-api-metrics'

// UI utilities
export { useCustomColor } from './use-custom-color'
export type { CustomColor } from './use-custom-color'
export { useCustomNotifications } from './use-custom-notifications'
export type { CustomNotification } from './use-custom-notifications'
export { useToast } from './use-toast'
export type { ToastType, Toast } from './use-toast'
export { useColors } from './use-colors'
export { useMetaColor, META_THEME_COLORS } from './use-meta-color'

// Tasks
export { useTasks, useTask } from './use-tasks'
export type { UseTasksOptions } from './use-tasks'
export type { Task } from '@/entities/task'

// Other utilities
export { useConfig } from './use-config'
export { useCopyToClipboard } from './use-copy-to-clipboard'
export { useCrudDialogs } from './use-crud-dialogs'
export { useMutationObserver } from './use-mutation-observer'
export { useOnClickOutside } from './useOnClickOutside'
export { useMounted } from './use-mounted'

