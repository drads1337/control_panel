/**
 * Filter and option constants
 * Consolidated from various files
 */

/**
 * Block type options
 */
export const BLOCK_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'rate_limit', label: 'Rate Limit' },
] as const;

/**
 * Block category options
 */
export const BLOCK_CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'malware', label: 'Malware' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'violation', label: 'Policy Violation' },
  { value: 'rate_limit', label: 'Rate Limit' },
] as const;

/**
 * Severity level options
 */
export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

/**
 * Key status options
 */
export const KEY_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' },
] as const;

/**
 * Activation status options
 */
export const ACTIVATION_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'activated', label: 'Activated' },
  { value: 'not_activated', label: 'Not activated' },
] as const;

/**
 * Device usage options
 */
export const DEVICE_USAGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'used', label: 'Used' },
  { value: 'unused', label: 'Unused' },
] as const;

/**
 * Max devices options
 */
export const MAX_DEVICES_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'single', label: 'Single device' },
  { value: 'multiple', label: 'Multiple devices' },
] as const;

/**
 * Date range options
 */
export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom period' },
] as const;

