"""
User Profile Service
Handles user profile operations: updates, password changes, avatar uploads, and profile data retrieval
"""

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from ...core.extensions import db
from ...models.core import User
from ...config.config import Config
from ...services.activity import activity_service
from ...utils.rbac_utils import RBACManager

class UserProfileService:
    """Service for handling user profile operations"""

    def __init__(self, logger=None, upload_folder=None):
        self.logger = logger or logging.getLogger(__name__)
        self.upload_folder = upload_folder or "uploads"

        self.allowed_avatar_extensions = Config.ALLOWED_AVATAR_EXTENSIONS
        self.max_avatar_size = Config.MAX_AVATAR_SIZE

    def update_user_profile(self, user: User, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Update user profile information

        Args:
            user: User object
            data: Dictionary with profile data

        Returns:
            Tuple of (success, error_message)
        """
        try:
            if "username" in data and data["username"]:
                if data["username"] != user.username:

                    existing_user = User.query.filter_by(username=data["username"]).first()
                    if existing_user and existing_user.id != user.id:
                        return False, "Username already exists"
                    user.username = data["username"]

            if "email" in data and data["email"]:
                new_email = data["email"].lower()

                current_email = user.email.lower() if user.email else None
                if new_email != current_email:

                    existing_user = User.query.filter_by(email=new_email).first()
                    if existing_user and existing_user.id != user.id:
                        return False, "Email already exists"
                    user.email = new_email

            if "first_name" in data:
                user.first_name = data["first_name"]

            if "last_name" in data:
                user.last_name = data["last_name"]

            if "phone" in data:
                user.phone = data["phone"]

            if "timezone" in data:
                user.timezone = data["timezone"]

            user.updated_at = datetime.utcnow()
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating user profile: {str(e)}", exc_info=True)
            return False, f"Failed to update profile: {str(e)}"

    def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Change user password

        Args:
            user: User object
            current_password: Current password
            new_password: New password

        Returns:
            Tuple of (success, error_message)
        """
        try:

            if not check_password_hash(user.password, current_password):
                return False, "Current password is incorrect"

            if len(new_password) < 8:
                return False, "New password must be at least 8 characters long"

            user.password = generate_password_hash(new_password)
            user.updated_at = datetime.utcnow()
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error changing password: {str(e)}")
            return False, "Failed to change password"

    def upload_avatar(self, user: User, file) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Upload user avatar

        SECURITY: Validates file signature (magic bytes) to prevent file type spoofing.
        This prevents attackers from uploading executable files with image extensions.

        Args:
            user: User object
            file: Uploaded file object

        Returns:
            Tuple of (success, error_message, avatar_url)
        """
        import tempfile
        
        try:
            if not file or not file.filename:
                return False, "No file provided", None

            if not self._is_valid_avatar_file(file):
                return False, "Invalid file type or size", None

            filename = secure_filename(file.filename)
            file_extension = filename.rsplit(".", 1)[1].lower()
            
            # SECURITY: Validate file signature (magic bytes) before saving
            # Save file temporarily to validate signature
            temp_file_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
                    file.seek(0)
                    temp_file.write(file.read())
                    temp_file_path = temp_file.name
                
                # Validate file signature - expect image extensions
                from ...services.files.file_service import file_service
                expected_extensions = [ext.lstrip('.').lower() for ext in self.allowed_avatar_extensions]
                is_valid, validation_error = file_service.validate_file_signature(temp_file_path, expected_extensions)
                
                if not is_valid:
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                    return False, validation_error or "Invalid file type: file signature validation failed", None
                
                # Reset file stream for saving
                file.seek(0)
            except Exception as validation_exception:
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except Exception:
                        pass
                self.logger.error(f"File signature validation error: {str(validation_exception)}")
                return False, "File validation failed", None
            finally:
                # Clean up temp file after validation
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except Exception:
                        pass

            unique_filename = f"{user.id}_{uuid.uuid4().hex}.{file_extension}"

            upload_dir = os.path.join(self.upload_folder, "avatars")
            os.makedirs(upload_dir, exist_ok=True)

            file_path = os.path.join(upload_dir, unique_filename)
            file.save(file_path)

            old_avatar = user.avatar
            user.avatar = f"avatars/{unique_filename}"
            user.updated_at = datetime.utcnow()
            db.session.commit()

            if old_avatar:
                self._delete_avatar_file(old_avatar)

            return True, None, user.avatar

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error uploading avatar: {str(e)}")
            return False, "Failed to upload avatar", None

    def _is_valid_avatar_file(self, file) -> bool:
        """Validate avatar file"""
        if not file.filename:
            return False

        if "." not in file.filename:
            return False

        file_extension = file.filename.rsplit(".", 1)[1].lower()
        if file_extension not in self.allowed_avatar_extensions:
            return False

        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        if file_size > self.max_avatar_size:
            return False

        return True

    def _delete_avatar_file(self, avatar_path: str) -> None:
        """Delete avatar file from filesystem"""
        try:
            if avatar_path:
                full_path = os.path.join(self.upload_folder, avatar_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
        except Exception as e:
            self.logger.warning(f"Failed to delete avatar file {avatar_path}: {e}")

    def get_user_profile(self, user: User) -> Dict[str, Any]:
        """
        Get user profile information

        Args:
            user: User object

        Returns:
            Dictionary with user profile data
        """

        user_permissions = []
        try:
            from ...utils.service_helpers import get_service
            
            # Use ServiceContainer to avoid circular imports
            rbac_service = get_service('rbac_service')

            permissions_set = rbac_service.get_user_permissions(user.id)
            user_permissions = list(permissions_set) if permissions_set else []
        except Exception as e:
            self.logger.warning(f"Failed to get user permissions for user {user.id}: {e}")
            user_permissions = []

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "timezone": user.timezone,
            "avatar": user.avatar,
            "roles": RBACManager.get_user_role_names(user),
            "permissions": user_permissions,
            "project_id": user.project_id,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "last_ip": user.last_ip,
            "last_country": user.last_country,
            "last_city": user.last_city,
        }

    def get_user_dashboard_data(self, user: User) -> Dict[str, Any]:
        """
        Get user dashboard data

        Args:
            user: User object

        Returns:
            Dictionary with dashboard data
        """
        try:
            dashboard_data = {
                "user": self.get_user_profile(user),
                "project": None,
                "devices": [],
                "recent_activity": [],
                "notifications": [],
            }

            if user.project_id:
                from ...models.core import Project

                project = Project.query.get(user.project_id)
                if project:
                    dashboard_data["project"] = {
                        "id": project.id,
                        "name": project.name,
                        "status": project.status,
                        "subscription_status": project.subscription_status,
                        "subscription_expires_at": (
                            project.subscription_expires_at.isoformat()
                            if project.subscription_expires_at
                            else None
                        ),
                    }

            try:
                from ...models.keys import DeviceInfo as Device

                devices = Device.query.filter_by(user_id=user.id).all()
                dashboard_data["devices"] = [
                    {
                        "id": device.id,
                        "name": device.name,
                        "type": device.type,
                        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
                        "is_active": device.is_active,
                    }
                    for device in devices
                ]
            except Exception as e:
                self.logger.warning(f"Failed to get device info: {e}")

            try:
                recent_activities = activity_service.get_user_activities(user.id, limit=10)
                dashboard_data["recent_activity"] = [
                    {
                        "id": activity.id,
                        "action": activity.action,
                        "details": activity.details,
                        "ip_address": activity.ip_address,
                        "created_at": activity.created_at.isoformat(),
                    }
                    for activity in recent_activities
                ]
            except Exception as e:
                self.logger.warning(f"Failed to get recent activity: {e}")

            try:
                from ...models.notifications import Notification

                notifications = (
                    Notification.query.filter_by(user_id=user.id, is_read=False).limit(5).all()
                )
                dashboard_data["notifications"] = [
                    {
                        "id": notification.id,
                        "title": notification.title,
                        "message": notification.message,
                        "type": notification.type,
                        "created_at": notification.created_at.isoformat(),
                    }
                    for notification in notifications
                ]
            except Exception as e:
                self.logger.warning(f"Failed to get notifications: {e}")

            return dashboard_data

        except Exception as e:
            self.logger.error(f"Error getting user dashboard data: {str(e)}")
            return {"error": "Failed to load dashboard data"}

user_profile_service = UserProfileService()
