import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  X, 
  AlertCircle,
  Zap,
  Shield,
  Gamepad2,
  Clock,
  Star
} from 'lucide-react';

export type CustomNotificationType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'loading' 
  | 'game_update' 
  | 'game_created' 
  | 'game_deleted';

export interface CustomNotificationProps {
  id: string;
  type: CustomNotificationType;
  title: string;
  description?: string;
  duration?: number;
  onClose: (id: string) => void;
  showProgress?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
}

const CustomNotification: React.FC<CustomNotificationProps> = ({
  id,
  type,
  title,
  description,
  duration = 5000,
  onClose,
  showProgress = true,
  action
}) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0 && showProgress) {
      const startTime = Date.now();
      const endTime = startTime + duration;
      
      const updateProgress = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const newProgress = (remaining / duration) * 100;
        
        if (newProgress > 0) {
          setProgress(newProgress);
          requestAnimationFrame(updateProgress);
        } else {
          handleClose();
        }
      };
      
      requestAnimationFrame(updateProgress);
    }
  }, [duration, showProgress]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'loading':
        return <Zap className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'game_update':
        return <Gamepad2 className="h-5 w-5 text-purple-600" />;
      case 'game_created':
        return <Star className="h-5 w-5 text-green-600" />;
      case 'game_deleted':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStyles = () => {
    const baseStyles = 'border shadow-lg min-w-[320px] max-w-[400px]';
    
    switch (type) {
      case 'success':
        return cn(baseStyles, 'border-green-200 bg-green-50 text-green-800');
      case 'error':
        return cn(baseStyles, 'border-red-200 bg-red-50 text-red-800');
      case 'warning':
        return cn(baseStyles, 'border-yellow-200 bg-yellow-50 text-yellow-800');
      case 'info':
        return cn(baseStyles, 'border-blue-200 bg-blue-50 text-blue-800');
      case 'loading':
        return cn(baseStyles, 'border-blue-200 bg-blue-50 text-blue-800');
      case 'game_update':
        return cn(baseStyles, 'border-purple-200 bg-purple-50 text-purple-800');
      case 'game_created':
        return cn(baseStyles, 'border-green-200 bg-green-50 text-green-800');
      case 'game_deleted':
        return cn(baseStyles, 'border-red-200 bg-red-50 text-red-800');
      default:
        return cn(baseStyles, 'border-gray-200 bg-gray-50 text-gray-800');
    }
  };

  const getActionStyles = (variant: 'primary' | 'secondary' | 'outline' = 'primary') => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700';
      case 'secondary':
        return 'bg-gray-600 text-white hover:bg-gray-700';
      case 'outline':
        return 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700';
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg transition-all duration-300',
        'animate-in slide-in-from-right-full',
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full',
        getStyles()
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm leading-tight">{title}</h4>
            {description && (
              <p className="text-sm opacity-90 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {showProgress && duration > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-current transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Action Button */}
      {action && (
        <div className="flex justify-end">
          <button
            onClick={action.onClick}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              getActionStyles(action.variant)
            )}
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};

export interface CustomNotificationContainerProps {
  notifications: Array<{
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
  }>;
  onRemove: (id: string) => void;
}

export const CustomNotificationContainer: React.FC<CustomNotificationContainerProps> = ({
  notifications,
  onRemove
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {notifications.map((notification) => (
        <CustomNotification
          key={notification.id}
          id={notification.id}
          type={notification.type}
          title={notification.title}
          description={notification.description}
          duration={notification.duration}
          showProgress={notification.showProgress}
          action={notification.action}
          onClose={onRemove}
        />
      ))}
    </div>
  );
};

export { CustomNotification }; 