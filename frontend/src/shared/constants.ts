/**
 * Централизованные константы для переиспользования в компонентах
 * 
 * @deprecated This file is kept for backward compatibility.
 * New code should import from '@/shared/constants' which exports organized constants by domain.
 * 
 * All constants have been moved to:
 * - @/shared/constants/filters - Filter options
 * - @/shared/constants/api - API endpoints
 * - @/shared/constants/roles - Role and permission constants
 * - @/shared/constants/ui - UI-related constants
 */

// Re-export from organized constants for backward compatibility
export {
  BLOCK_TYPE_OPTIONS,
  BLOCK_CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  KEY_STATUS_OPTIONS,
  ACTIVATION_STATUS_OPTIONS,
  DEVICE_USAGE_OPTIONS,
  MAX_DEVICES_OPTIONS,
  DATE_RANGE_OPTIONS,
} from './constants/filters';

