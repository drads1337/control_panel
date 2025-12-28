import * as React from 'react';
import { RotateCcw, ArrowUpRight } from 'lucide-react';
import { motion, type Transition } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import type { UserNotification } from '@/entities/notification';

interface NotificationListProps {
  notifications: UserNotification[];
  onViewAll?: () => void;
  limit?: number;
  onNotificationClick?: (notificationId: number) => void;
}

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' },
};

function NotificationList({ notifications, onViewAll, limit = 3, onNotificationClick }: NotificationListProps) {
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const getNotificationColors = (type: string) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          border: 'border-red-300 dark:border-red-700',
          text: 'text-red-800 dark:text-red-200',
          dot: 'bg-red-500',
        };
      case 'success':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          border: 'border-green-300 dark:border-green-700',
          text: 'text-green-800 dark:text-green-200',
          dot: 'bg-green-500',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          border: 'border-yellow-300 dark:border-yellow-700',
          text: 'text-yellow-800 dark:text-yellow-200',
          dot: 'bg-yellow-500',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          border: 'border-blue-300 dark:border-blue-700',
          text: 'text-blue-800 dark:text-blue-200',
          dot: 'bg-blue-500',
        };
    }
  };

  const parseNotification = (notification: UserNotification) => {
    const message = notification.message || '';
    let title = '';
    let subtitle = message;

    // Try to parse "Title: Message" format (as sent from notification form)
    if (message.includes(':')) {
      const parts = message.split(':', 2);
      if (parts.length === 2) {
        title = parts[0].trim();
        subtitle = parts[1].trim();
      } else {
        title = message;
        subtitle = '';
      }
    } else {
      // If no colon, use first part as title, rest as subtitle
      const words = message.split(' ');
      if (words.length > 5) {
        title = words.slice(0, 3).join(' ');
        subtitle = words.slice(3).join(' ');
      } else {
        title = message;
        subtitle = '';
      }
    }

    return { title, subtitle };
  };

  const displayedNotifications = notifications.slice(0, limit);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (notifications.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="bg-neutral-200 dark:bg-neutral-900 p-3 rounded-3xl w-full space-y-3 shadow-md"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {displayedNotifications.map((notification, i) => {
          const { title, subtitle } = parseNotification(notification);
          const colors = getNotificationColors(notification.type);
          return (
            <motion.div
              key={notification.id}
              className={`${colors.bg} ${colors.border} border rounded-xl px-4 py-2 shadow-sm hover:shadow-lg transition-shadow duration-200 relative cursor-pointer`}
              variants={getCardVariants(i)}
              transition={transition}
              style={{
                zIndex: displayedNotifications.length - i,
              }}
              onClick={() => onNotificationClick?.(notification.id)}
            >
              <div className="flex justify-between items-center">
                <h1 className={`text-sm font-medium ${colors.text}`}>{title}</h1>
                {!notification.is_read && (
                  <div className={`size-2 rounded-full ${colors.dot}`} />
                )}
              </div>
              {subtitle && (
                <div className={`text-xs font-medium mt-1 ${colors.text} opacity-80`}>
                  <span>{formatTime(notification.created_at)}</span>
                  {subtitle && (
                    <>
                      &nbsp;•&nbsp;
                      <span>{subtitle}</span>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="size-5 rounded-full bg-neutral-400 text-white text-xs flex items-center justify-center font-medium">
          {notifications.length}
        </div>
        <span className="grid">
          <motion.span
            className="text-sm font-medium text-neutral-600 dark:text-neutral-300 row-start-1 col-start-1"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            Notifications{unreadCount > 0 && ` (${unreadCount})`}
          </motion.span>
          {onViewAll && (
            <motion.span
              className="text-sm font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1"
              variants={viewAllTextVariants}
              transition={textSwitchTransition}
              onClick={onViewAll}
            >
              View all <ArrowUpRight className="size-4" />
            </motion.span>
          )}
        </span>
      </div>
    </motion.div>
  );
}

export { NotificationList };
