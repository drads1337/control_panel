/**
 * Utility functions for checking if a license key is masked
 */

export function isMaskedKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Check if key contains only dots or asterisks (common masking patterns)
  const maskedPattern = /^[•·*.\s]+$/;
  if (maskedPattern.test(key)) {
    return true;
  }
  
  // Check if key has a pattern like "XXXX-XXXX-XXXX" where X is a masking character
  const partialMaskPattern = /^[•·*.\s-]+$/;
  if (partialMaskPattern.test(key.replace(/-/g, ''))) {
    return true;
  }
  
  return false;
}

