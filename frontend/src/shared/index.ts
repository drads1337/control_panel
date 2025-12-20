/**
 * @deprecated This directory is being migrated to @/lib
 * Use @/lib instead of @/shared
 * 
 * Backward compatibility re-exports:
 */

// API re-exports
export * from '@/lib/api'

// Lib re-exports  
export * from '@/lib/utils'
export * from '@/lib/hooks'
export * from '@/lib/constants'

// Model stores (Zustand stores) - kept here for backward compatibility
// These are UI state stores and can stay in shared/model
export * from './model'

// UI components - kept here for backward compatibility
// These are shared UI components
export * from './ui'

