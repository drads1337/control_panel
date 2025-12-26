/**
 * Shared module exports
 * This is the main entry point for all shared utilities, components, and helpers
 */

// API exports
export * from './api'

// Lib exports (utilities, hooks, validations, etc.)
// Note: Some utilities like getApiUrl and getErrorMessage are exported from both api and lib
// Use explicit imports when there's ambiguity
export * from './lib'

// Hooks
export * from './hooks'

// Constants
export * from './constants'

// Model stores (Zustand stores) - UI state management
export * from './model'

// UI components
export * from './ui/components'

// Utils (legacy, use shared/lib/utils instead)
export * from './utils'
