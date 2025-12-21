/**
 * Shared hooks - UI utilities and common hooks
 * These hooks are domain-agnostic and can be used across the entire application
 */

// Core hooks
export { useDebounce } from './use-debounce'
export { useIsMobile } from './use-mobile'
export { useIsMac } from './use-is-mac'
export { useSelection } from './use-selection'
export type { UseSelectionOptions, UseSelectionReturn } from './use-selection'

// API and data hooks
export { useApiMetrics } from './use-api-metrics'
export { useAuth } from './use-auth'
export { useConfig } from './use-config'
export { useCrudDialogs } from './use-crud-dialogs'
export { useMutationWithCache } from './use-mutation-helpers'
export type { CreateMutationOptions } from './use-mutation-helpers'
export { useMutationObserver } from './use-mutation-observer'
export { useMutationWithInvalidation } from './use-mutation-with-invalidation'
export { usePaginatedQuery } from './use-paginated-query'
export { usePaginatedResource } from './use-paginated-resource'
export { usePermissions } from './use-permissions'
export { useTasks } from './use-tasks'

// UI hooks
export { useColors } from './use-colors'
export { useCustomColor } from './use-custom-color'
export { useCustomNotifications } from './use-custom-notifications'
export { useMetaColor } from './use-meta-color'
export { useMounted } from './use-mounted'
export { usePerformanceDetection } from './use-performance-detection'
export { useThemesConfig } from './use-themes-config'
export { useToast } from './use-toast'
export { useCopyToClipboard } from './use-copy-to-clipboard'
export { useOnClickOutside } from './useOnClickOutside'