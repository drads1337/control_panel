// RBAC Components and Hooks Export
export * from './permission-guard'
export * from './route-guard'
export * from './conditional-render'
export * from './rbac-example'

// Re-export hooks for convenience
export { usePermissions } from '@/hooks/use-permissions'
export { useRBACApi } from '@/hooks/use-rbac-api'

// Re-export utilities
export * from '@/lib/rbac-utils'
