import { DATE_FORMATS, VALIDATION, API_BASE_URL } from '../constants';

export const formatDate = (date: string | Date, format: string = DATE_FORMATS.DISPLAY): string => {
  if (!date) return '';

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24 && dateObj.toDateString() === now.toDateString()) {
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }

  if (diffInHours < 168) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[dateObj.getDay()]} ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }

  return dateObj.toLocaleString('en-US');
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatNumber = (number: number): string => {
  return new Intl.NumberFormat('en-US').format(number);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const generateId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const validateEmail = (email: string): boolean => {
  return VALIDATION.EMAIL_REGEX.test(email);
};

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

  if (!/[A-Za-z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

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

export const validatePhone = (phone: string): boolean => {
  return VALIDATION.PHONE_REGEX.test(phone);
};

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

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {

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

export const downloadFile = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

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

export const downloadCSV = (data: any[], columns: Array<{ label: string; field: string }>, filename: string = 'export.csv'): void => {
  const csv = createCSV(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
};

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

export const isEmpty = (obj: any): boolean => {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
};

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

export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {

  const { api } = await import('@/shared/api')

  const method = (options.method?.toUpperCase() || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

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

    const response = await api.request({
      url: endpoint,
      method,
      data,
      headers: options.headers as any,
    })

    return response.data
  } catch (error: any) {

    if (error.response?.status === 401 || error.response?.status === 403) {
      return { unauthorized: true }
    }

    throw error
  }
}

export const getCurrentUser = async (): Promise<any> => {
  return await apiRequest('/api/me');
};

export const logoutUser = (): void => {

  localStorage.removeItem('user');

};

export const isAuthenticated = (): boolean => {
  is deprecated. Use useAuthContext().isAuthenticated instead');

  return false;
};

export const getToken = (): string | null => {
  is deprecated. Tokens are now stored in HTTP-only cookies and not accessible from JavaScript');

  return null;
};

export const getUser = (): any => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const logUserAction = async (action: string, meta: Record<string, any> = {}): Promise<void> => {
  try {

    await fetch(`${API_BASE_URL}/api/logs`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...meta })
    });
  } catch (e) {

  }
};
