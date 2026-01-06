/**
 * Checks if a value is masked (e.g., "abcd****xyz" or similar patterns)
 * Masked values typically contain asterisks or other masking characters
 */
export function isMaskedValue(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }
  
  // Check for common masking patterns:
  // - Contains asterisks: "abcd****xyz"
  // - Contains dots: "abcd....xyz"
  // - Very short values that look like placeholders
  const maskedPatterns = [
    /\*{2,}/,           // Two or more asterisks
    /\.{4,}/,           // Four or more dots
    /^.{0,3}\*+.{0,3}$/, // Short strings with asterisks
  ]
  
  return maskedPatterns.some(pattern => pattern.test(value))
}

/**
 * Filters out fields from data that were masked in the original data.
 * This prevents sending empty strings for fields that should remain unchanged.
 * 
 * @param data - The data to filter
 * @param originalData - The original data that may contain masked values
 * @returns Filtered data with masked fields removed
 */
export function filterMaskedValues<T extends Record<string, unknown>>(
  data: T,
  originalData?: Partial<Record<string, unknown>>
): Partial<T> {
  if (!originalData) {
    return data
  }

  const filtered: Partial<T> = { ...data }

  // Remove fields that were masked in the original data
  // If a field was masked, it means the backend is protecting it
  // and we shouldn't send empty strings to update it
  for (const key in data) {
    if (key in originalData) {
      const originalValue = originalData[key]
      const newValue = data[key]

      // If the original value was masked and the new value is empty/unchanged,
      // remove it from the update payload
      if (
        typeof originalValue === 'string' &&
        isMaskedValue(originalValue) &&
        (newValue === '' || newValue === originalValue || !newValue)
      ) {
        delete filtered[key]
      }
    }
  }

  return filtered
}

