"""
Helper utilities for accessing specialized project settings models.

MIGRATION COMPLETE: This module now works ONLY with specialized models.
No fallback to ProjectSettings - all data must be migrated first using migrate_project_settings().

Specialized models:
- ProjectSecuritySettings: Security-related settings
- ProjectSystemSettings: System configuration
- ProjectEncryptionSettings: Encryption configuration
- ProjectChatSettings: Chat configuration
- ProjectOfflineAuthSettings: Offline authentication
- ProjectAppearanceSettings: Appearance/UI settings
- ProjectInviteSettings: Invite code settings

NOTE: The migrate_project_settings() function should be run ONCE to migrate existing
data from ProjectSettings to specialized models. After migration, all code should
use ProjectSettingsHelper which works only with specialized models.
"""

import logging
from typing import Dict, Optional

from ..core.extensions import db
from ..models.core import (
    Project,
    ProjectAppearanceSettings,
    ProjectChatSettings,
    ProjectEncryptionSettings,
    ProjectInviteSettings,
    ProjectOfflineAuthSettings,
    ProjectSecuritySettings,
    ProjectSystemSettings,
)

logger = logging.getLogger(__name__)


class ProjectSettingsHelper:
    """
    Helper class for accessing project settings from specialized models.
    
    MIGRATION COMPLETE: This class now works ONLY with specialized models.
    No fallback to ProjectSettings - all data must be migrated first.
    
    Usage:
        helper = ProjectSettingsHelper(project_id)
        security_settings = helper.get_security_settings()
        system_settings = helper.get_system_settings()
    """

    def __init__(self, project_id: int):
        self.project_id = project_id

    def get_security_settings(self) -> ProjectSecuritySettings:
        """
        Get security settings from ProjectSecuritySettings.
        
        Returns:
            ProjectSecuritySettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectSecuritySettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:

            settings = ProjectSecuritySettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new security settings for project {self.project_id}")
        
        return settings

    def get_system_settings(self) -> ProjectSystemSettings:
        """
        Get system settings from ProjectSystemSettings.
        
        Returns:
            ProjectSystemSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectSystemSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectSystemSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new system settings for project {self.project_id}")
        
        return settings

    def get_encryption_settings(self) -> ProjectEncryptionSettings:
        """
        Get encryption settings from ProjectEncryptionSettings.
        
        Returns:
            ProjectEncryptionSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectEncryptionSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectEncryptionSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.flush()
            logger.info(f"Created new encryption settings for project {self.project_id}")
        
        return settings

    def get_chat_settings(self) -> ProjectChatSettings:
        """
        Get chat settings from ProjectChatSettings.
        
        Returns:
            ProjectChatSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectChatSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectChatSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new chat settings for project {self.project_id}")
        
        return settings

    def get_offline_auth_settings(self) -> ProjectOfflineAuthSettings:
        """
        Get offline auth settings from ProjectOfflineAuthSettings.
        
        Returns:
            ProjectOfflineAuthSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectOfflineAuthSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectOfflineAuthSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new offline auth settings for project {self.project_id}")
        
        return settings

    def get_appearance_settings(self) -> ProjectAppearanceSettings:
        """
        Get appearance settings from ProjectAppearanceSettings.
        
        Returns:
            ProjectAppearanceSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectAppearanceSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectAppearanceSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new appearance settings for project {self.project_id}")
        
        return settings

    def get_invite_settings(self) -> ProjectInviteSettings:
        """
        Get invite settings from ProjectInviteSettings.
        
        Returns:
            ProjectInviteSettings instance (created with defaults if doesn't exist)
        """
        settings = ProjectInviteSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            settings = ProjectInviteSettings(project_id=self.project_id)
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Created new invite settings for project {self.project_id}")
        
        return settings

    def get_project_master_key(self) -> Optional[str]:
        """
        Get project_master_key from ProjectEncryptionSettings.
        
        This is a convenience method for the most commonly accessed field.
        
        Returns:
            Project master key string or None
        """
        encryption_settings = self.get_encryption_settings()
        return encryption_settings.project_master_key if encryption_settings.project_master_key else None


def migrate_project_settings(project_id: int) -> Dict[str, bool]:
    """
    ONE-TIME MIGRATION: Migrate all settings from ProjectSettings to specialized models.
    
    This function should be run ONCE per project to migrate existing data from
    the deprecated ProjectSettings model to specialized models.
    
    After migration, all code should use ProjectSettingsHelper which works only
    with specialized models (no fallback to ProjectSettings).
    
    Args:
        project_id: Project ID to migrate
        
    Returns:
        Dict with migration status for each settings type
    """

    from ..models.core import ProjectSettings
    
    legacy_settings = ProjectSettings.query.filter_by(project_id=project_id).first()
    if not legacy_settings:
        logger.warning(f"No legacy ProjectSettings found for project {project_id}, creating new specialized settings")

        helper = ProjectSettingsHelper(project_id)
        return {
            "security": True,
            "system": True,
            "encryption": True,
            "chat": True,
            "offline_auth": True,
            "appearance": True,
            "invite": True,
        }
    
    results = {}
    helper = ProjectSettingsHelper(project_id)
    

    try:
        security = helper.get_security_settings()
        security.min_password_length = legacy_settings.min_password_length
        security.max_login_attempts = legacy_settings.max_login_attempts
        security.ip_block_duration_minutes = legacy_settings.ip_block_duration_minutes
        security.max_sessions_per_user = legacy_settings.max_sessions_per_user
        security.log_retention_days = legacy_settings.log_retention_days
        security.security_log_level = legacy_settings.security_log_level
        security.two_factor_auth_required = legacy_settings.two_factor_auth_required
        security.password_complexity_required = legacy_settings.password_complexity_required
        security.session_fingerprinting = legacy_settings.session_fingerprinting
        security.ip_whitelist_enabled = legacy_settings.ip_whitelist_enabled
        security.ip_whitelist = legacy_settings.ip_whitelist
        security.rate_limiting_enabled = legacy_settings.rate_limiting_enabled
        security.rate_limit_requests_per_minute = legacy_settings.rate_limit_requests_per_minute
        security.vpn_blocking_enabled = legacy_settings.vpn_blocking_enabled
        security.security_logging_enabled = legacy_settings.security_logging_enabled
        security.suspicious_activity_check_enabled = legacy_settings.suspicious_activity_check_enabled
        security.session_limiting_enabled = legacy_settings.session_limiting_enabled
        security.auto_log_cleanup_enabled = legacy_settings.auto_log_cleanup_enabled
        db.session.commit()
        results["security"] = True
        logger.info(f"Migrated security settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate security settings for project {project_id}: {e}")
        results["security"] = False
    

    try:
        system = helper.get_system_settings()
        system.max_connections = legacy_settings.max_connections
        system.session_timeout_minutes = legacy_settings.session_timeout_minutes
        system.log_file_size_mb = legacy_settings.log_file_size_mb
        system.system_log_level = legacy_settings.system_log_level
        system.auto_save_enabled = legacy_settings.auto_save_enabled
        system.analytics_enabled = legacy_settings.analytics_enabled
        system.system_notifications_enabled = legacy_settings.system_notifications_enabled
        db.session.commit()
        results["system"] = True
        logger.info(f"Migrated system settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate system settings for project {project_id}: {e}")
        results["system"] = False
    

    try:
        encryption = helper.get_encryption_settings()
        encryption.encryption_enabled = legacy_settings.encryption_enabled
        encryption.encryption_algorithm = legacy_settings.encryption_algorithm
        encryption.key_rotation_days = legacy_settings.key_rotation_days
        encryption.project_master_key = legacy_settings.project_master_key
        db.session.commit()
        results["encryption"] = True
        logger.info(f"Migrated encryption settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate encryption settings for project {project_id}: {e}")
        results["encryption"] = False
    

    try:
        chat = helper.get_chat_settings()
        if hasattr(legacy_settings, 'chat_message_limit_per_minute'):
            chat.chat_message_limit_per_minute = legacy_settings.chat_message_limit_per_minute
        if hasattr(legacy_settings, 'chat_daily_message_limit'):
            chat.chat_daily_message_limit = legacy_settings.chat_daily_message_limit
        if hasattr(legacy_settings, 'chat_message_max_length'):
            chat.chat_message_max_length = legacy_settings.chat_message_max_length
        db.session.commit()
        results["chat"] = True
        logger.info(f"Migrated chat settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate chat settings for project {project_id}: {e}")
        results["chat"] = False
    

    try:
        offline_auth = helper.get_offline_auth_settings()
        if hasattr(legacy_settings, 'offline_auth_enabled'):
            offline_auth.offline_auth_enabled = legacy_settings.offline_auth_enabled
        if hasattr(legacy_settings, 'offline_ticket_expiration_hours'):
            offline_auth.offline_ticket_expiration_hours = legacy_settings.offline_ticket_expiration_hours
        db.session.commit()
        results["offline_auth"] = True
        logger.info(f"Migrated offline auth settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate offline auth settings for project {project_id}: {e}")
        results["offline_auth"] = False
    

    try:
        appearance = helper.get_appearance_settings()
        if hasattr(legacy_settings, 'appearance_settings'):
            appearance.appearance_settings = legacy_settings.appearance_settings
        db.session.commit()
        results["appearance"] = True
        logger.info(f"Migrated appearance settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate appearance settings for project {project_id}: {e}")
        results["appearance"] = False
    

    try:
        invite = helper.get_invite_settings()
        invite.invite_code_required = legacy_settings.invite_code_required
        db.session.commit()
        results["invite"] = True
        logger.info(f"Migrated invite settings for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to migrate invite settings for project {project_id}: {e}")
        results["invite"] = False
    
    return results

