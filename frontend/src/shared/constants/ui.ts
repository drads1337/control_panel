
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 40, 50],
  MAX_PAGE_SIZE: 100,
} as const;

export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  FILTER: 200,
  AUTO_SAVE: 1000,
} as const;

export const FILE_UPLOAD = {
  // SECURITY: Reduced from 5GB to 100MB to prevent browser memory issues
  // Files larger than this should use chunked upload (not yet implemented on backend)
  MAX_SIZE: 100 * 1024 * 1024, // 100MB
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB per chunk
  CHUNKED_UPLOAD_THRESHOLD: 100 * 1024 * 1024, // Use chunked upload for files > 100MB
  MAX_FILES: 50,
} as const;
