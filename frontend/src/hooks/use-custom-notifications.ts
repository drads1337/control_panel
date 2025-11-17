import { useState, useCallback } from 'react';
import { CustomNotificationType } from '@/components/ui/custom-notification';

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
    
    // Автоматически удаляем уведомление через указанное время
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

  // Специализированные методы для игр
  const showGameUpdateNotification = useCallback((
    gameName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('game_update', `Игра "${gameName}" обновлена`, {
      description: options?.description || 'Настройки игры были успешно изменены',
      duration: 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);

  const showGameCreatedNotification = useCallback((
    gameName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('game_created', `Игра "${gameName}" создана`, {
      description: options?.description || 'Новая игра была успешно добавлена в систему',
      duration: 5000,
      showProgress: true,
      action: options?.action
    });
  }, [addNotification]);

  const showGameDeletedNotification = useCallback((
    gameName: string,
    options?: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
      };
    }
  ) => {
    return addNotification('game_deleted', `Игра "${gameName}" удалена`, {
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
    // Специализированные методы
    showGameUpdateNotification,
    showGameCreatedNotification,
    showGameDeletedNotification,
    showLoadingNotification,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification
  };
}; 