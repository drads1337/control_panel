/**
 * Avatar cache utilities
 * Handles clearing of cached avatar blob URLs
 */

/**
 * Clears all cached avatar blob URLs
 * This is called during logout to ensure no avatar data persists
 */
export function clearAllAvatarBlobs(): void {
  // Clear any blob URLs that might be stored in memory
  // This is a no-op if no blob URLs are being cached
  // In the future, if avatar blobs are cached, they should be cleared here
  
  // If avatars are stored as blob URLs in localStorage or sessionStorage, clear them
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('avatar_') || key.includes('avatar_blob')) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    // Ignore errors - localStorage might not be available
  }

  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach(key => {
      if (key.startsWith('avatar_') || key.includes('avatar_blob')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (error) {
    // Ignore errors - sessionStorage might not be available
  }
}

