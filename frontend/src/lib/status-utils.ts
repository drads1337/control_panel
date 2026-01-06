/**
 * Status utility functions for consistent status display
 */

export type StatusType = 'active' | 'inactive' | 'maintenance' | 'testing' | 'expired' | 'pending' | 'completed' | 'failed' | 'in_progress' | 'not_activated';

export function getStatusClasses(status: StatusType): string {
  const baseClasses = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-200';
  
  switch (status) {
    case 'active':
      return `${baseClasses} bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800`;
    case 'inactive':
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700`;
    case 'maintenance':
      return `${baseClasses} bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800`;
    case 'testing':
      return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800`;
    case 'expired':
      return `${baseClasses} bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800`;
    case 'pending':
      return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800`;
    case 'completed':
      return `${baseClasses} bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800`;
    case 'failed':
      return `${baseClasses} bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800`;
    case 'in_progress':
      return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800`;
    case 'not_activated':
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700`;
  }
}

export function getStatusText(status: StatusType): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'maintenance':
      return 'Maintenance';
    case 'testing':
      return 'Testing';
    case 'expired':
      return 'Expired';
    case 'pending':
      return 'Pending';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'in_progress':
      return 'In Progress';
    case 'not_activated':
      return 'Not activated';
    default:
      return String(status).charAt(0).toUpperCase() + String(status).slice(1);
  }
}
