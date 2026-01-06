/**
 * Request Manager
 * 
 * Prevents duplicate requests by tracking in-flight requests.
 * If a request with the same key is made while another is in progress,
 * it returns the existing promise instead of making a new request.
 */

// Map to track in-flight requests by key
const pendingRequests = new Map<string, Promise<any>>()

/**
 * Prevents duplicate requests by reusing in-flight promises.
 * 
 * @param key - Unique identifier for the request (e.g., 'keys-1-20-all-all--all')
 * @param requestFn - Async function that performs the actual request
 * @returns Promise that resolves with the request result
 * 
 * @example
 * ```ts
 * const result = await preventDuplicateRequest('my-request-key', async () => {
 *   return await api.get('/endpoint')
 * })
 * ```
 */
export async function preventDuplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check if there's already a pending request with this key
  const existingRequest = pendingRequests.get(key)
  
  if (existingRequest) {
    // Return the existing promise
    return existingRequest as Promise<T>
  }
  
  // Create a new request promise
  const requestPromise = requestFn()
    .then((result) => {
      // Remove from pending requests when completed
      pendingRequests.delete(key)
      return result
    })
    .catch((error) => {
      // Remove from pending requests on error
      pendingRequests.delete(key)
      throw error
    })
  
  // Store the promise for potential duplicate requests
  pendingRequests.set(key, requestPromise)
  
  return requestPromise
}

/**
 * Clears all pending requests.
 * Useful for cleanup or testing.
 */
export function clearPendingRequests(): void {
  pendingRequests.clear()
}

/**
 * Removes a specific pending request by key.
 * 
 * @param key - The key of the request to remove
 */
export function removePendingRequest(key: string): void {
  pendingRequests.delete(key)
}

/**
 * Gets the number of currently pending requests.
 * 
 * @returns The number of pending requests
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size
}

