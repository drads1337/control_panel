import { DATE_FORMATS, VALIDATION, API_BASE_URL } from '../constants';

/**
 * Formats date in readable format
 * @param date - Date to format
 * @param format - Date format (default DISPLAY)
 * @returns Formatted date
 */
export const formatDate = (date: string | Date, format: string = DATE_FORMATS.DISPLAY): string => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);
  
  // If date is today, show time
  if (diffInHours < 24 && dateObj.toDateString() === now.toDateString()) {
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // If date is yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }
  
  // If date is within a week
  if (diffInHours < 168) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[dateObj.getDay()]} ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }
  
  // Otherwise full date
  return dateObj.toLocaleString('en-US');
};

/**
 * Formats file size in readable format
 * @param bytes - Size in bytes
 * @returns Formatted size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Formats number with separators
 * @param number - Number to format
 * @returns Formatted number
 */
export const formatNumber = (number: number): string => {
  return new Intl.NumberFormat('en-US').format(number);
};

/**
 * Truncates text to specified length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Generates random ID
 * @param length - ID length
 * @returns Random ID
 */
export const generateId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validates email
 * @param email - Email to validate
 * @returns Validation result
 */
export const validateEmail = (email: string): boolean => {
  return VALIDATION.EMAIL_REGEX.test(email);
};

/**
 * Validates password
 * @param password - Password to validate
 * @param minLength - Minimum password length
 * @param complexityRequired - Whether to enforce complex password rules
 * @returns Validation result with errors
 */
export const validatePassword = (password: string, minLength: number = 8, complexityRequired: boolean = false): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (password.length > 128) {
    errors.push('Password is too long');
  }
  
  // Basic validation - at least one letter and one number
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Complex password validation if required
  if (complexityRequired) {
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates phone
 * @param phone - Phone to validate
 * @returns Validation result
 */
export const validatePhone = (phone: string): boolean => {
  return VALIDATION.PHONE_REGEX.test(phone);
};

/**
 * Validates username
 * @param username - Username to validate
 * @returns Validation result with errors
 */
export const validateUsername = (username: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!username) {
    errors.push('Username is required');
  } else {
    if (username.length < VALIDATION.USERNAME_MIN_LENGTH) {
      errors.push(`Username must contain at least ${VALIDATION.USERNAME_MIN_LENGTH} characters`);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers and underscore');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Copies text to clipboard
 * @param text - Text to copy
 * @returns Copy result
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

/**
 * Downloads file
 * @param url - File URL
 * @param filename - File name
 */
export const downloadFile = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Creates CSV from array of objects
 * @param data - Array of objects
 * @param columns - Array of columns
 * @returns CSV string
 */
export const createCSV = (data: any[], columns: Array<{ label: string; field: string }>): string => {
  const headers = columns.map(col => col.label).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.field];
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    }).join(',')
  );
  
  return [headers, ...rows].join('\n');
};

/**
 * Downloads data as CSV
 * @param data - Data array
 * @param columns - Columns array
 * @param filename - File name
 */
export const downloadCSV = (data: any[], columns: Array<{ label: string; field: string }>, filename: string = 'export.csv'): void => {
  const csv = createCSV(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
};

/**
 * Groups array by key
 * @param array - Array to group
 * @param key - Key to group by
 * @returns Grouped object
 */
export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

/**
 * Sorts array by multiple keys
 * @param array - Array to sort
 * @param sortKeys - Array of keys to sort by
 * @returns Sorted array
 */
export const sortByMultiple = <T>(array: T[], sortKeys: Array<{ key: keyof T; order?: 'asc' | 'desc' }>): T[] => {
  return array.sort((a, b) => {
    for (const { key, order = 'asc' } of sortKeys) {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

/**
 * Filters array by multiple conditions
 * @param array - Array to filter
 * @param filters - Object with filters
 * @returns Filtered array
 */
export const filterByMultiple = <T>(array: T[], filters: Record<string, any>): T[] => {
  return array.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value === 'all') return true;
      
      const itemValue = (item as any)[key];
      if (typeof value === 'function') {
        return value(itemValue);
      }
      
      if (Array.isArray(value)) {
        return value.includes(itemValue);
      }
      
      return itemValue === value;
    });
  });
};

/**
 * Debounces function
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttles function
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Checks if object is empty
 * @param obj - Object to check
 * @returns Check result
 */
export const isEmpty = (obj: any): boolean => {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
};

/**
 * Deep clones object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};

/**
 * Gets value from object by path
 * @param obj - Object
 * @param path - Path to value (e.g., 'user.profile.name')
 * @param defaultValue - Default value
 * @returns Value
 */
export const get = <T>(obj: any, path: string, defaultValue?: T): T | undefined => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
};

/**
 * Sets value in object by path
 * @param obj - Object
 * @param path - Path to value
 * @param value - Value to set
 * @returns New object
 */
export const set = <T>(obj: any, path: string, value: T): any => {
  const keys = path.split('.');
  const result = deepClone(obj);
  let current = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
};

/**
 * API functions for authentication
 * 
 * @deprecated Use centralized axios instance (api from '@/shared/api') instead
 * This function is kept for backward compatibility only
 * 
 * All new code should use:
 * - import { api } from '@/shared/api'
 * - api.get(), api.post(), api.put(), api.delete() etc.
 * 
 * The centralized axios instance provides:
 * - Automatic CSRF token handling
 * - Centralized error handling
 * - Request/response interceptors
 * - Monitoring integration
 */

/**
 * Executes HTTP request to API
 * @deprecated Use api from '@/shared/api' instead
 * @param endpoint - Endpoint for request
 * @param options - Request options
 * @returns Request result
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  // Use centralized axios instance instead of fetch
  const { api } = await import('@/shared/api')
  
  const method = (options.method?.toUpperCase() || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  
  // Parse body if present
  let data: any = undefined
  if (options.body) {
    if (options.body instanceof FormData) {
      data = options.body
    } else if (typeof options.body === 'string') {
      try {
        data = JSON.parse(options.body)
      } catch {
        data = options.body
      }
    } else {
      data = options.body
    }
  }
  
  try {
    // CSRF token and credentials are automatically handled by axios interceptors
    const response = await api.request({
      url: endpoint,
      method,
      data,
      headers: options.headers as any,
    })
    
    return response.data
  } catch (error: any) {
    // Handle 401/403 errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { unauthorized: true }
    }
    
    console.error('API request failed:', error)
    throw error
  }
}

/**
 * NOTE: Authentication functions (loginUser, registerUser) have been moved to:
 * - authService (services/auth-service.ts) - for API calls
 * - useAuth hook (hooks/use-auth.ts) - for authentication state management
 * - auth-context (contexts/auth-context.tsx) - for React context
 * 
 * Use useAuthContext() to access authentication functions instead of importing from utils.
 */

/**
 * Get current user information
 * @returns User information
 */
export const getCurrentUser = async (): Promise<any> => {
  return await apiRequest('/api/me');
};

/**
 * User logout
 * Updated for HTTP-only cookies - no longer manages tokens directly
 */
export const logoutUser = (): void => {
  console.log('Logging out user...'); // Debug information
  // No longer need to clear localStorage tokens
  // httpOnly cookies are automatically cleared by the server
  // Only clear user info for UI purposes
  localStorage.removeItem('user');
  console.log('Cleared user info for logout');
  // Note: HTTP-only cookies are cleared by the backend logout endpoint
};

/**
 * Check user authorization
 * Updated for HTTP-only cookies - this function is deprecated
 * Use the auth context instead: useAuthContext().isAuthenticated
 * @returns Authorization status
 * @deprecated Use useAuthContext().isAuthenticated instead
 */
export const isAuthenticated = (): boolean => {
  console.warn('isAuthenticated() is deprecated. Use useAuthContext().isAuthenticated instead');
  // Can't check HTTP-only cookies from JavaScript
  // This function is kept for backward compatibility but should not be used
  return false;
};

/**
 * Get user token
 * Updated for HTTP-only cookies - tokens are no longer accessible from JavaScript
 * @returns User token
 * @deprecated Tokens are now stored in HTTP-only cookies and not accessible from JavaScript
 */
export const getToken = (): string | null => {
  console.warn('getToken() is deprecated. Tokens are now stored in HTTP-only cookies and not accessible from JavaScript');
  // SECURITY FIX: Can't access HTTP-only cookies from JavaScript
  return null;
};

/**
 * Get user information from localStorage
 * @returns User information
 */
export const getUser = (): any => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

/**
 * Log user action
 * @param action - Action description
 * @param meta - Additional data (optional)
 * @returns Promise
 */
export const logUserAction = async (action: string, meta: Record<string, any> = {}): Promise<void> => {
  try {
    // Use credentials: 'include' to send HTTP-only cookies
    await fetch(`${API_BASE_URL}/api/logs`, {
      method: 'POST',
      credentials: 'include', // Include HTTP-only cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...meta })
    });
  } catch (e) {
    // Don't bother user if logging failed
    console.warn('Failed to log action:', e);
  }
};
