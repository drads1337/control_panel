"""
Notification Service
Handles notification management operations
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.notifications import Notification
from ...utils.rbac_utils import RBACManager
from ...utils.structured_logging import get_logger

class NotificationService:
    """Service for handling notification operations"""

    def __init__(self):
        self.logger = get_logger("notification_service")

    def create_notification(
        self,
        user: User,
        message: str,
        notification_type: str = "info",
        target_user_id: Optional[int] = None,
        repeat_count: int = 1,
    ) -> Tuple[Optional[Notification], Optional[str]]:
        """
        Create a new notification

        Args:
            user: User creating the notification
            message: Notification message
            notification_type: Type of notification
            target_user_id: Target user ID (optional)
            repeat_count: Number of times to repeat notification

        Returns:
            Tuple of (Notification object or None, error message or None)
        """
        try:

            if target_user_id:
                target_user = User.query.filter_by(
                    id=target_user_id, project_id=user.project_id
                ).first()
                if not target_user:
                    return None, "Target user not found"

            notification = Notification(
                message=message,
                type=notification_type,
                user_id=target_user_id,
                project_id=user.project_id,
                is_read=False,
                repeat_count=repeat_count,
                show_count=0,
                is_deleted=False,
                created_at=datetime.utcnow(),
            )

            db.session.add(notification)
            db.session.commit()

            self.logger.info(f"Created notification {notification.id} for user {user.id}")
            return notification, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating notification: {str(e)}")
            return None, "Failed to create notification"

    def send_notifications(
        self,
        user: User,
        message: str,
        target_user_ids: List[int],
        notification_type: str = "info",
        title: Optional[str] = None,
        repeat_count: int = 1,
    ) -> Tuple[int, List[int], Optional[str]]:
        """
        Send notifications to multiple users

        Args:
            user: User sending the notifications
            message: Notification message
            target_user_ids: List of target user IDs
            notification_type: Type of notification
            title: Optional title for notification
            repeat_count: Number of times to repeat notification

        Returns:
            Tuple of (notifications_created, notification_ids, error_message)
        """
        try:

            target_user_objects = User.query.filter(
                User.id.in_(target_user_ids), User.project_id == user.project_id
            ).all()

            if len(target_user_objects) != len(target_user_ids):
                return 0, [], "One or more target users not found or do not belong to this project"

            workers_only = [
                target_user
                for target_user in target_user_objects
                if not RBACManager.is_admin(target_user) and not RBACManager.is_owner(target_user)
            ]

            if not workers_only:
                return (
                    0,
                    [],
                    "No workers found to send notifications to. Admin and owner users are excluded.",
                )

            if title:
                formatted_message = f"{title}: {message}"
            else:
                formatted_message = message

            notifications_created = 0
            notification_ids = []

            for target_user in workers_only:
                notification = Notification(
                    message=formatted_message,
                    type=notification_type,
                    user_id=target_user.id,
                    project_id=user.project_id,
                    is_read=False,
                    repeat_count=repeat_count,
                    show_count=0,
                    is_deleted=False,
                    created_at=datetime.utcnow(),
                )
                db.session.add(notification)
                db.session.flush()
                notification_ids.append(notification.id)
                notifications_created += 1

            db.session.commit()

            self.logger.info(
                f"Created {notifications_created} notifications for workers in project {user.project_id}"
            )

            return notifications_created, notification_ids, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error sending notifications: {str(e)}")
            return 0, [], f"Failed to send notifications: {str(e)}"

    def mark_notification_read(
        self, user: User, notification_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Mark a notification as read

        Args:
            user: User marking the notification
            notification_id: Notification ID

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Get notification
            notification = Notification.query.filter_by(id=notification_id, project_id=user.project_id).first()

            if not notification:
                return False, "Notification not found"

            if notification.user_id and notification.user_id != user.id:

                from ...services.rbac import rbac_service

                can_view_all = rbac_service.check_permission(
                    user.id, "employees.view"
                ) or rbac_service.check_permission(user.id, "clients.view")

                if not can_view_all:
                    return False, "Access denied"

            notification.is_read = True
            db.session.commit()

            self.logger.info(f"Marked notification {notification_id} as read for user {user.id}")
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error marking notification as read: {str(e)}")
            return False, "Failed to mark notification as read"

    def delete_notification(
        self, user: User, notification_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Soft delete a notification

        Args:
            user: User deleting the notification
            notification_id: Notification ID

        Returns:
            Tuple of (success, error_message)
        """
        try:
            from sqlalchemy import text

            result = db.session.execute(
                text("SELECT is_deleted, project_id, user_id FROM notification WHERE id = :notification_id"),
                {"notification_id": notification_id},
            ).fetchone()

            if not result:
                return False, "Notification not found"

            is_deleted, project_id, notification_user_id = result

            if is_deleted:
                return True, "Notification already deleted"

            if project_id != user.project_id:
                return False, "Access denied"

            if notification_user_id and notification_user_id != user.id:

                from ...services.rbac import rbac_service

                can_delete_all = rbac_service.check_permission(
                    user.id, "employees.send_notification"
                ) or rbac_service.check_permission(user.id, "clients.send_notification")

                if not can_delete_all:
                    return False, "Access denied"

            db.session.execute(
                text(
                    "UPDATE notification SET is_deleted = :is_deleted, deleted_at = :deleted_at WHERE id = :notification_id"
                ),
                {
                    "is_deleted": True,
                    "deleted_at": datetime.utcnow(),
                    "notification_id": notification_id,
                },
            )

            db.session.commit()

            self.logger.info(f"Soft deleted notification {notification_id} for user {user.id}")
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting notification: {str(e)}")
            return False, "Failed to delete notification"

    def cleanup_old_notifications(
        self, user: User, days_old: int = 30
    ) -> Tuple[int, Optional[str]]:
        """
        Cleanup old read notifications

        Args:
            user: User performing cleanup
            days_old: Number of days old to consider for cleanup

        Returns:
            Tuple of (deleted_count, error_message)
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)

            # Use repository to get notifications for cleanup
            # Note: Repository doesn't support bulk delete with filters, so we use direct query
            # In production, this could be added to repository
            deleted_count = Notification.query.filter(
                Notification.project_id == user.project_id,
                Notification.created_at < cutoff_date,
                Notification.is_read == True,
            ).delete()

            db.session.commit()

            self.logger.info(
                f"Cleaned up {deleted_count} notifications older than {days_old} days for project {user.project_id}"
            )

            return deleted_count, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error cleaning up notifications: {str(e)}")
            return 0, f"Failed to cleanup notifications: {str(e)}"

notification_service = NotificationService()
