"""
Settings Manager
Handles business logic, caching, and response building for project settings.

Single Responsibility: Business logic and orchestration for settings operations.
"""

import json
import logging
from typing import Any, Dict, Optional

from ...models.core import User
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import BusinessLogicError

try:
    from ...services.cache import cache_service
except ImportError:
    cache_service = None

from .settings_repository import SettingsRepository

logger = logging.getLogger(__name__)


class SettingsManager:
    """
    Manager for project settings business logic.
    
    Single Responsibility: Business logic, caching, and response building for settings.
    """

    def __init__(self, repository: Optional[SettingsRepository] = None, cache_service=None, logger=None):
        self.repository = repository or SettingsRepository()
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance"""
        return self.cache_service if self.cache_service is not None else cache_service

    def resolve_project_id(
        self, user: User, project_id: Optional[int] = None
    ) -> int:
        """
        Resolve project_id for a user.
        
        Returns:
            Resolved project_id
            
        Raises:
            BusinessLogicError: If project_id cannot be resolved
        """
        # Check if user is owner - owners can work without project_id
        is_owner = RBACManager.is_owner(user)
        
        # Use project_id from parameter (passed by middleware) or fallback logic
        if not project_id:
            if is_owner:
                # For owners without project_id, try to use first available project as fallback
                try:
                    # First try active projects
                    first_project = self.repository.get_first_available_project(active_only=True)
                    # If no active projects, try any project
                    if not first_project:
                        first_project = self.repository.get_first_available_project(active_only=False)
                    if first_project:
                        project_id = first_project.id
                        self.logger.info(
                            f"Owner {user.id} has no selected project, using first available project {project_id} as fallback"
                        )
                    else:
                        raise BusinessLogicError("No projects available. Please create a project first to view settings.")
                except BusinessLogicError:
                    raise
                except Exception as project_lookup_error:
                    self.logger.error(f"Error looking up projects for owner {user.id}: {project_lookup_error}")
                    raise BusinessLogicError("Project selection required. Please select a project to view settings.")
            else:
                # Non-owners must have project_id
                project_id = user.project_id
                if not project_id:
                    raise BusinessLogicError("User must be assigned to a project")
        
        return project_id

    def build_settings_response(
        self, settings: Any, encryption_keys: Dict[str, str], user: User
    ) -> Dict[str, Any]:
        """
        Build settings response dictionary from database models.
        
        Args:
            settings: ProjectSettings model instance
            encryption_keys: Dict with aes_key and public_key
            user: User model instance
            
        Returns:
            Dictionary with settings organized by category
        """
        try:
            # Parse appearance settings
            appearance_settings = {}
            try:
                if hasattr(settings, "appearance_settings") and settings.appearance_settings:
                    appearance_settings = json.loads(settings.appearance_settings)
            except (json.JSONDecodeError, TypeError, AttributeError):
                appearance_settings = {}

            # Ensure encryption_keys has required fields
            if not encryption_keys or not isinstance(encryption_keys, dict):
                encryption_keys = {"aes_key": "", "public_key": ""}
            
            if "aes_key" not in encryption_keys:
                encryption_keys["aes_key"] = ""
            if "public_key" not in encryption_keys:
                encryption_keys["public_key"] = ""

            # Build response structure
            result = {
                "security": {
                    "min_password_length": int(getattr(settings, "min_password_length", 8) or 8),
                    "max_login_attempts": int(getattr(settings, "max_login_attempts", 5) or 5),
                    "ip_block_duration_minutes": int(
                        getattr(settings, "ip_block_duration_minutes", 15) or 15
                    ),
                    "max_sessions_per_user": int(getattr(settings, "max_sessions_per_user", 3) or 3),
                    "log_retention_days": int(getattr(settings, "log_retention_days", 30) or 30),
                    "security_log_level": str(getattr(settings, "security_log_level", "INFO") or "INFO"),
                },
                "registration": {
                    "invite_code_required": bool(getattr(settings, "invite_code_required", False))
                },
                "system": {
                    "max_connections": int(getattr(settings, "max_connections", 1000) or 1000),
                    "session_timeout_minutes": int(
                        getattr(settings, "session_timeout_minutes", 480) or 480
                    ),
                    "log_file_size_mb": int(getattr(settings, "log_file_size_mb", 100) or 100),
                    "system_log_level": str(getattr(settings, "system_log_level", "INFO") or "INFO"),
                    "auto_save_enabled": bool(getattr(settings, "auto_save_enabled", True)),
                    "analytics_enabled": bool(getattr(settings, "analytics_enabled", True)),
                    "system_notifications_enabled": bool(
                        getattr(settings, "system_notifications_enabled", True)
                    ),
                },
                "security_features": {
                    "two_factor_auth_required": bool(
                        getattr(settings, "two_factor_auth_required", False)
                    ),
                    "password_complexity_required": bool(
                        getattr(settings, "password_complexity_required", True)
                    ),
                    "session_fingerprinting": bool(getattr(settings, "session_fingerprinting", True)),
                    "ip_whitelist_enabled": bool(getattr(settings, "ip_whitelist_enabled", False)),
                    "ip_whitelist": str(self._format_ip_whitelist(getattr(settings, "ip_whitelist", None))),
                    "rate_limiting_enabled": bool(getattr(settings, "rate_limiting_enabled", True)),
                    "rate_limit_requests_per_minute": int(
                        getattr(settings, "rate_limit_requests_per_minute", 60) or 60
                    ),
                    "vpn_blocking_enabled": bool(getattr(settings, "vpn_blocking_enabled", False)),
                    "security_logging_enabled": bool(
                        getattr(settings, "security_logging_enabled", True)
                    ),
                    "suspicious_activity_check_enabled": bool(
                        getattr(settings, "suspicious_activity_check_enabled", True)
                    ),
                    "session_limiting_enabled": bool(getattr(settings, "session_limiting_enabled", True)),
                    "auto_log_cleanup_enabled": bool(
                        getattr(settings, "auto_log_cleanup_enabled", True)
                    ),
                },
                "appearance": appearance_settings if isinstance(appearance_settings, dict) else {},
                "encryption": {
                    "encryption_enabled": bool(getattr(settings, "encryption_enabled", False)),
                    "encryption_algorithm": str(
                        getattr(settings, "encryption_algorithm", "AES-256") or "AES-256"
                    ),
                    "key_rotation_days": int(getattr(settings, "key_rotation_days", 90) or 90),
                },
                "backup": {
                    "auto_backup_enabled": bool(getattr(settings, "auto_backup_enabled", False)),
                    "backup_frequency_hours": int(
                        getattr(settings, "backup_frequency_hours", 24) or 24
                    ),
                    "backup_retention_days": int(
                        getattr(settings, "backup_retention_days", 30) or 30
                    ),
                },
                "offline_auth": {
                    "offline_auth_enabled": bool(getattr(settings, "offline_auth_enabled", False)),
                    "offline_ticket_expiration_hours": int(
                        getattr(settings, "offline_ticket_expiration_hours", 12) or 12
                    ),
                },
                "encryption_keys": {
                    "aes_key": str(encryption_keys.get("aes_key", "") or ""),
                    "public_key": str(encryption_keys.get("public_key", "") or ""),
                },
            }

            # Filter admin-only sections for non-admin users
            try:
                is_admin = RBACManager.is_admin(user)
            except Exception as admin_check_error:
                self.logger.error(f"Error checking admin status for user {user.id}: {admin_check_error}")
                is_admin = False

            if not is_admin:
                admin_only_sections = [
                    "encryption_keys",
                    "encryption",
                    "backup",
                    "system",
                    "security_features",
                    "security",
                    "offline_auth",
                    "registration",
                ]
                for section in admin_only_sections:
                    result.pop(section, None)
                self.logger.info(f"Filtered admin-only sections for non-admin user {user.id}")

            return result
        except Exception as e:
            self.logger.error(f"Error building settings response: {e}")
            raise

    def get_settings(
        self, user_id: int, project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get project settings with caching support.
        
        Args:
            user_id: User ID
            project_id: Optional project ID (passed by middleware)
            
        Returns:
            Dictionary with settings or error message
        """
        try:
            # Get user
            user = self.repository.get_user(user_id)
            if not user:
                return {"error": "User not found"}

            # Resolve project_id (raises BusinessLogicError if cannot resolve)
            project_id = self.resolve_project_id(user, project_id)

            # Get settings and keys from repository
            settings = self.repository.get_or_create_project_settings(project_id)
            encryption_keys = self.repository.get_or_create_project_encryption_keys(project_id)

            # Build response
            result = self.build_settings_response(settings, encryption_keys, user)
            
            self.logger.info(f"Successfully retrieved settings for user {user_id}, project {project_id}")
            return result

        except Exception as e:
            self.logger.error(f"Error getting settings: {e}", exc_info=True)
            return {"error": f"Failed to retrieve settings: {str(e)}"}

    def update_settings(
        self, user_id: int, settings_data: Dict[str, Any], project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update project settings.
        
        Args:
            user_id: User ID
            settings_data: Dictionary with settings to update
            project_id: Optional project ID (passed by middleware)
            
        Returns:
            Dictionary with success status or error message
        """
        try:
            from ...core.extensions import db

            # Get user
            user = self.repository.get_user(user_id)
            if not user:
                return {"error": "User not found"}

            # Resolve project_id (raises BusinessLogicError if cannot resolve)
            project_id = self.resolve_project_id(user, project_id)

            # Update settings from settings_data (works with specialized models)
            self._update_settings_from_data(project_id, settings_data)

            # Commit changes
            db.session.commit()

            # Invalidate cache
            self.invalidate_settings_cache(user_id)

            return {"success": True, "message": "Settings updated successfully"}

        except Exception as e:
            from ...core.extensions import db
            db.session.rollback()
            self.logger.error(f"Error updating settings: {e}", exc_info=True)
            return {"error": f"Failed to update settings: {str(e)}"}

    def _update_settings_from_data(self, project_id: int, settings_data: Dict[str, Any]) -> None:
        """
        Update specialized settings models from settings_data dictionary.
        
        Args:
            project_id: Project ID
            settings_data: Dictionary with settings to update
        """
        from ...utils.project_settings_migration import ProjectSettingsHelper
        
        helper = ProjectSettingsHelper(project_id)
        
        if "security" in settings_data:
            security_settings = helper.get_security_settings()
            security = settings_data["security"]
            for key in [
                "min_password_length",
                "max_login_attempts",
                "ip_block_duration_minutes",
                "max_sessions_per_user",
                "log_retention_days",
                "security_log_level",
            ]:
                if key in security:
                    setattr(security_settings, key, security[key])

        if "registration" in settings_data:
            invite_settings = helper.get_invite_settings()
            registration = settings_data["registration"]
            if "invite_code_required" in registration:
                invite_settings.invite_code_required = registration["invite_code_required"]

        if "system" in settings_data:
            system_settings = helper.get_system_settings()
            system = settings_data["system"]
            for key in [
                "max_connections",
                "session_timeout_minutes",
                "log_file_size_mb",
                "system_log_level",
                "auto_save_enabled",
                "analytics_enabled",
                "system_notifications_enabled",
            ]:
                if key in system:
                    setattr(system_settings, key, system[key])

        if "security_features" in settings_data:
            security_settings = helper.get_security_settings()
            security_features = settings_data["security_features"]
            for key in [
                "two_factor_auth_required",
                "password_complexity_required",
                "session_fingerprinting",
                "ip_whitelist_enabled",
                "rate_limiting_enabled",
                "rate_limit_requests_per_minute",
                "vpn_blocking_enabled",
                "security_logging_enabled",
                "suspicious_activity_check_enabled",
                "session_limiting_enabled",
                "auto_log_cleanup_enabled",
            ]:
                if key in security_features:
                    setattr(security_settings, key, security_features[key])
            
            if "ip_whitelist" in security_features:
                ip_whitelist = security_features["ip_whitelist"]
                if isinstance(ip_whitelist, list):
                    security_settings.ip_whitelist = json.dumps(ip_whitelist)
                elif isinstance(ip_whitelist, str):
                    security_settings.ip_whitelist = ip_whitelist
                else:
                    security_settings.ip_whitelist = None

        if "appearance" in settings_data:
            appearance_settings = helper.get_appearance_settings()
            appearance_settings.appearance_settings = json.dumps(settings_data["appearance"])

        if "encryption" in settings_data:
            encryption_settings = helper.get_encryption_settings()
            encryption = settings_data["encryption"]
            for key in ["encryption_enabled", "encryption_algorithm", "key_rotation_days"]:
                if key in encryption:
                    setattr(encryption_settings, key, encryption[key])

        if "backup" in settings_data:
            backup_settings = helper.get_backup_settings()
            backup = settings_data["backup"]
            for key in ["auto_backup_enabled", "backup_frequency_hours", "backup_retention_days"]:
                if key in backup:
                    setattr(backup_settings, key, backup[key])
        
        if "offline_auth" in settings_data:
            offline_auth_settings = helper.get_offline_auth_settings()
            offline_auth = settings_data["offline_auth"]
            for key in ["offline_auth_enabled", "offline_ticket_expiration_hours"]:
                if key in offline_auth:
                    setattr(offline_auth_settings, key, offline_auth[key])

    def _format_ip_whitelist(self, ip_whitelist_value) -> str:
        """Format IP whitelist as JSON string for frontend"""
        try:
            if not ip_whitelist_value:
                return "[]"

            if isinstance(ip_whitelist_value, str):
                try:
                    json.loads(ip_whitelist_value)
                    return ip_whitelist_value
                except json.JSONDecodeError:
                    return "[]"

            if isinstance(ip_whitelist_value, list):
                return json.dumps(ip_whitelist_value)

            return "[]"
        except Exception as e:
            self.logger.warning(f"Error formatting IP whitelist: {e}")
            return "[]"

    def invalidate_settings_cache(self, user_id: int) -> bool:
        """Invalidate settings cache for a user"""
        try:
            cache_svc = self._cache_service
            if cache_svc is None:
                self.logger.warning("Cache service not available, skipping cache invalidation")
                return False
            cache_svc.delete("settings", user_id=user_id)
            self.logger.info(f"Settings cache invalidated for user {user_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error invalidating settings cache: {e}")
            return False

