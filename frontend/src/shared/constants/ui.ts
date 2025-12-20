
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
  MAX_SIZE: 5 * 1024 * 1024 * 1024,
  CHUNK_SIZE: 5 * 1024 * 1024,
  MAX_FILES: 50,
} as const;
