from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ServiceError
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

    def __init__(self, rbac_service=None):
        self._rbac_service = rbac_service
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
            if not target_user_ids:
                return 0, [], "No target users specified"

            self.logger.debug(
                f"Sending notifications: user_id={user.id}, project_id={user.project_id}, "
                f"target_user_ids={target_user_ids}, message_length={len(message)}"
            )

            # API returns unique_id as id, so we need to search by both id and unique_id
            # If value is 9 digits, it's likely a unique_id (string), otherwise it's an id (int)
            # Convert all to strings for unique_id lookup, and keep as ints for id lookup
            target_user_ids_str = [str(uid) for uid in target_user_ids]
            
            # Try to find users by both id (integer) and unique_id (string)
            # First try by id (for small integers)
            users_by_id = User.query.filter(User.id.in_(target_user_ids)).all()
            
            # Then try by unique_id (for 9-digit strings)
            users_by_unique_id = User.query.filter(User.unique_id.in_(target_user_ids_str)).all()
            
            # Combine and deduplicate
            all_users_any_project = list({u.id: u for u in users_by_id + users_by_unique_id}.values())
            all_existing_user_ids = {u.id for u in all_users_any_project}
            all_existing_unique_ids = {u.unique_id for u in all_users_any_project}
            
            # Map input IDs to actual user IDs
            # If input is a 9-digit number (likely unique_id), map it to the actual user.id
            id_mapping = {}
            for uid in target_user_ids:
                uid_str = str(uid)
                # If 9 digits, treat as unique_id
                if len(uid_str) == 9 and uid_str.isdigit():
                    # Find user by unique_id
                    user_by_unique = next((u for u in all_users_any_project if u.unique_id == uid_str), None)
                    if user_by_unique:
                        id_mapping[uid] = user_by_unique.id
                    else:
                        id_mapping[uid] = uid  # Keep original if not found
                else:
                    # Treat as regular id
                    user_by_id = next((u for u in all_users_any_project if u.id == uid), None)
                    if user_by_id:
                        id_mapping[uid] = user_by_id.id
                    else:
                        id_mapping[uid] = uid  # Keep original if not found
            
            # Then filter by project_id - enforce project isolation
            # Users must belong to the same project as the sender (both must have matching project_id)
            # If sender has project_id, target must have the same project_id (not None)
            if user.project_id is not None:
                target_user_objects = [
                    u for u in all_users_any_project 
                    if u.project_id == user.project_id
                ]
            else:
                # If sender has no project_id, only allow targets with no project_id
                target_user_objects = [
                    u for u in all_users_any_project 
                    if u.project_id is None
                ]

            # Map target IDs to actual user IDs for validation
            mapped_target_ids = [id_mapping.get(uid, uid) for uid in target_user_ids]

            if len(target_user_objects) != len(target_user_ids):
                # Find which users are missing or don't belong to the project
                # Use mapped IDs for comparison
                found_user_ids = {user_obj.id for user_obj in target_user_objects}
                missing_user_ids = [uid for uid in mapped_target_ids if uid not in found_user_ids]
                # Keep original IDs for error messages
                missing_original_ids = [
                    orig_id for orig_id, mapped_id in zip(target_user_ids, mapped_target_ids)
                    if mapped_id not in found_user_ids
                ]
                
                # Check if they exist but belong to different project (or have None project_id when sender has one)
                wrong_project_user_ids = [
                    mapped_id for mapped_id, orig_id in zip(mapped_target_ids, target_user_ids)
                    if mapped_id in all_existing_user_ids and mapped_id not in found_user_ids
                ]
                # Get original IDs for wrong project users
                wrong_project_original_ids = [
                    orig_id for orig_id, mapped_id in zip(target_user_ids, mapped_target_ids)
                    if mapped_id in wrong_project_user_ids
                ]
                
                not_found_user_ids = [
                    orig_id for orig_id, mapped_id in zip(target_user_ids, mapped_target_ids)
                    if mapped_id not in all_existing_user_ids
                ]
                
                error_parts = []
                if not_found_user_ids:
                    ids_str = ', '.join(map(str, not_found_user_ids))
                    error_parts.append(f"User IDs [{ids_str}] not found in database")
                if wrong_project_original_ids:
                    ids_str = ', '.join(map(str, wrong_project_original_ids))
                    error_parts.append(f"User IDs [{ids_str}] belong to a different project (project isolation enforced)")
                
                error_msg = "One or more target users not found or do not belong to this project"
                if error_parts:
                    error_msg += f": {', '.join(error_parts)}"
                else:
                    error_msg += ". Please refresh the user list and try again."
                
                self.logger.warning(
                    f"Notification send failed: user_id={user.id}, project_id={user.project_id}, "
                    f"target_user_ids={target_user_ids}, found={len(target_user_objects)}, "
                    f"not_found={not_found_user_ids}, wrong_project={wrong_project_original_ids}"
                )
                
                return 0, [], error_msg

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
                # Use injected dependency instead of Service Locator
                if not self._rbac_service:
                    raise ServiceError(
                        "RBACService dependency not injected",
                        status_code=500
                    )
                can_view_all = self._rbac_service.check_permission(
                    user.id, "employees.view"
                ) or self._rbac_service.check_permission(user.id, "clients.view")

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
                # Use injected dependency instead of Service Locator
                if not self._rbac_service:
                    raise ServiceError(
                        "RBACService dependency not injected",
                        status_code=500
                    )
                can_delete_all = self._rbac_service.check_permission(
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

