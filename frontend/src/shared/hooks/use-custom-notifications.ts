import { useState, useCallback } from 'react';
import { CustomNotificationType } from '@/shared/ui/components/custom-notification';
export interface CustomNotification {
  id: string;
  type: CustomNotificationType;
  title: string;
  description?: string;
  duration?: number;
  showProgress?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
}
export const useCustomNotifications = () => {
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);
  const addNotification = useCallback((
    type: CustomNotificationType,
    title: string,
    options?: {
      description?: string;
      duration?: number;
      showProgress?: boolean;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: CustomNotification = {
      id,
      type,
      title,
      description: options?.description,
      duration: options?.duration,
      showProgress: options?.showProgress,
      action: options?.action
    };
    setNotifications(prev => [...prev, newNotification]);
    if (options?.duration && options.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, options.duration);
    }
    return id;
  }, []);
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  const showProductUpdateNotification = useCallback((
    productName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('product_update', `Игра "${productName}" обновлена`, {
      description: options?.description || 'Настройки игры были успешно изменены',
      duration: 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showProductCreatedNotification = useCallback((
    productName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('product_created', `Игра "${productName}" создана`, {
      description: options?.description || 'Новая игра была успешно добавлена в систему',
      duration: 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showProductDeletedNotification = useCallback((
    productName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('product_deleted', `Игра "${productName}" удалена`, {
      description: options?.description || 'Игра была успешно удалена из системы',
      duration: 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showLoadingNotification = useCallback((
    title: string,
    description?: string,
    duration?: number
  ) => {
    return addNotification('loading', title, {
      description,
      duration: duration || 3000,
      showProgress: false
    });
  }, [addNotification]);
  const showSuccessNotification = useCallback((
    title: string,
    description?: string,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('success', title, {
      description,
      duration: options?.duration || 4000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showErrorNotification = useCallback((
    title: string,
    description?: string,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('error', title, {
      description,
      duration: options?.duration || 8000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showWarningNotification = useCallback((
    title: string,
    description?: string,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('warning', title, {
      description,
      duration: options?.duration || 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  const showInfoNotification = useCallback((
    title: string,
    description?: string,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('info', title, {
      description,
      duration: options?.duration || 4000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);
  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showProductUpdateNotification,
    showProductCreatedNotification,
    showProductDeletedNotification,
    showLoadingNotification,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification
  };
}; 