"""
Key Status Service
Handles key status management: pause, resume, block, unblock, archive, restore
"""

from typing import Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.keys import Key
from ...utils.structured_logging import get_logger

class KeyStatusService:
    """Service for managing key statuses"""

    def __init__(self):
        self.logger = get_logger("key_status_service")

    def _change_key_status(
        self, user: User, key_id: int, new_status: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Internal method to change key status with counter updates

        Args:
            user: User changing the status
            key_id: Key ID
            new_status: New status value

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = new_status

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, new_status)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, new_status)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to change key status: {str(e)}")
            return False, f"Failed to change key status: {str(e)}"

    def pause_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Pause a key (set status to 0 - inactive)

        Args:
            user: User pausing the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 0)

    def resume_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Resume a key (set status to 1 - active)

        Args:
            user: User resuming the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 1)

    def block_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Block a key (set status to 2 - blocked)

        Args:
            user: User blocking the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 2)

    def unblock_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Unblock a key (set status to 1 - active)

        Args:
            user: User unblocking the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 1)

    def archive_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Archive a key (set status to 4 - archived)

        Args:
            user: User archiving the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 4)

    def restore_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Restore an archived key (set status to 1 - active)

        Args:
            user: User restoring the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        return self._change_key_status(user, key_id, 1)

    def extend_key(
        self, user: User, key_id: int, hours: float
    ) -> Tuple[bool, Optional[str]]:
        """
        Extend a key's expiration time

        Args:
            user: User extending the key
            key_id: Key ID
            hours: Hours to add

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            if hours <= 0:
                return False, "Hours must be positive"

            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            from datetime import datetime, timedelta

            if key.expires_at:
                key.expires_at += timedelta(hours=hours)
            else:
                key.expires_at = datetime.utcnow() + timedelta(hours=hours)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to extend key: {str(e)}")
            return False, f"Failed to extend key: {str(e)}"

