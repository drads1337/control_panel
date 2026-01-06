import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the URL for a user avatar.
 * Accepts values like: `null`, `undefined`, `"filename.png"`, `"avatars/filename.png"`, `"/avatars/filename.png"`,
 * `"/uploads/avatars/filename.png"`, `"uploads/avatars/filename.png"`.
 */
export function getAvatarUrl(avatar?: string | null): string | undefined {
  if (!avatar) return undefined
  const clean = avatar.startsWith("/") ? avatar.slice(1) : avatar

  // Already an uploads path
  if (clean.startsWith("uploads/")) return `/${clean}`

  // Given "avatars/..." -> "/uploads/avatars/..."
  if (clean.startsWith("avatars/")) return `/uploads/${clean}`

  // Default: treat as filename
  return `/uploads/avatars/${clean}`
}
