/**
 * Re-export CSRF utilities from shared/lib/csrf
 * This maintains backward compatibility for imports from @/lib/csrf
 */
export {
  getCsrfToken,
  prefetchCsrfToken,
  getCsrfHeaders,
  clearCsrfToken,
  isCsrfError,
  handleCsrfError
} from '@/shared/lib/csrf'

