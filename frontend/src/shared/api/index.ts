// Re-export all shared API utilities
export * from './enhanced-client'
export * from './config'
export * from './types'
export * from './auth-error-handler'

// Export api as alias for enhancedApi for backward compatibility
export { enhancedApi as api } from './enhanced-client'
