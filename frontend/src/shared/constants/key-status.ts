/**
 * Key status constants
 * These values match the backend key status values
 */
export const KEY_STATUS = {
  INACTIVE: 0,
  ACTIVE: 1,
  BLOCKED: 2,
  PAUSED: 3,
} as const

export type KeyStatus = typeof KEY_STATUS[keyof typeof KEY_STATUS]

