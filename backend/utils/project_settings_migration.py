"""
Helper utilities for migrating from ProjectSettings (God-object) to specialized settings models.

This module provides helper functions to:
1. Migrate data from ProjectSettings to specialized models
2. Access settings from specialized models with fallback to ProjectSettings
3. Gradually migrate codebase from ProjectSettings to specialized models

Specialized models:
- ProjectSecuritySettings: Security-related settings
- ProjectSystemSettings: System configuration
- ProjectEncryptionSettings: Encryption configuration
- ProjectBackupSettings: Backup configuration
- ProjectChatSettings: Chat configuration
- ProjectOfflineAuthSettings: Offline authentication
- ProjectAppearanceSettings: Appearance/UI settings
- ProjectInviteSettings: Invite code settings
"""

import logging
from typing import Dict, Optional

from ..core.extensions import db
from ..models.core import (
    Project,
    ProjectAppearanceSettings,
    ProjectBackupSettings,
    ProjectChatSettings,
    ProjectEncryptionSettings,
    ProjectInviteSettings,
    ProjectOfflineAuthSettings,
    ProjectSecuritySettings,
    ProjectSettings,
    ProjectSystemSettings,
)

logger = logging.getLogger(__name__)


class ProjectSettingsHelper:
    """
    Helper class for accessing project settings with automatic migration support.
    
    This class provides a clean interface to access settings from specialized models,
    with automatic fallback to ProjectSettings for backward compatibility.
    
    Usage:
        helper = ProjectSettingsHelper(project_id)
        security_settings = helper.get_security_settings()
        system_settings = helper.get_system_settings()
    """

    def __init__(self, project_id: int):
        self.project_id = project_id
        self._legacy_settings: Optional[ProjectSettings] = None

    def _get_legacy_settings(self) -> Optional[ProjectSettings]:
        """Get legacy ProjectSettings if needed"""
        if self._legacy_settings is None:
            self._legacy_settings = ProjectSettings.query.filter_by(
                project_id=self.project_id
            ).first()
        return self._legacy_settings

    def get_security_settings(self) -> ProjectSecuritySettings:
        """
        Get security settings from ProjectSecuritySettings with fallback to ProjectSettings.
        
        Returns:
            ProjectSecuritySettings instance (created if doesn't exist)
        """
        settings = ProjectSecuritySettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            # Try to migrate from legacy ProjectSettings
            legacy = self._get_legacy_settings()
            settings = ProjectSecuritySettings(project_id=self.project_id)
            
            if legacy:
                # Migrate security-related fields
                settings.min_password_length = legacy.min_password_length
                settings.max_login_attempts = legacy.max_login_attempts
                settings.ip_block_duration_minutes = legacy.ip_block_duration_minutes
                settings.max_sessions_per_user = legacy.max_sessions_per_user
                settings.log_retention_days = legacy.log_retention_days
                settings.security_log_level = legacy.security_log_level
                settings.two_factor_auth_required = legacy.two_factor_auth_required
                settings.password_complexity_required = legacy.password_complexity_required
                settings.session_fingerprinting = legacy.session_fingerprinting
                settings.ip_whitelist_enabled = legacy.ip_whitelist_enabled
                settings.ip_whitelist = legacy.ip_whitelist
                settings.rate_limiting_enabled = legacy.rate_limiting_enabled
                settings.rate_limit_requests_per_minute = legacy.rate_limit_requests_per_minute
                settings.vpn_blocking_enabled = legacy.vpn_blocking_enabled
                settings.security_logging_enabled = legacy.security_logging_enabled
                settings.suspicious_activity_check_enabled = legacy.suspicious_activity_check_enabled
                settings.session_limiting_enabled = legacy.session_limiting_enabled
                settings.auto_log_cleanup_enabled = legacy.auto_log_cleanup_enabled
                
                logger.info(f"Migrated security settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_system_settings(self) -> ProjectSystemSettings:
        """
        Get system settings from ProjectSystemSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectSystemSettings instance (created if doesn't exist)
        """
        settings = ProjectSystemSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectSystemSettings(project_id=self.project_id)
            
            if legacy:
                settings.max_connections = legacy.max_connections
                settings.session_timeout_minutes = legacy.session_timeout_minutes
                settings.log_file_size_mb = legacy.log_file_size_mb
                settings.system_log_level = legacy.system_log_level
                settings.auto_save_enabled = legacy.auto_save_enabled
                settings.analytics_enabled = legacy.analytics_enabled
                settings.system_notifications_enabled = legacy.system_notifications_enabled
                
                logger.info(f"Migrated system settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_encryption_settings(self) -> ProjectEncryptionSettings:
        """
        Get encryption settings from ProjectEncryptionSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectEncryptionSettings instance (created if doesn't exist)
        """
        settings = ProjectEncryptionSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectEncryptionSettings(project_id=self.project_id)
            
            if legacy:
                settings.encryption_enabled = legacy.encryption_enabled
                settings.encryption_algorithm = legacy.encryption_algorithm
                settings.key_rotation_days = legacy.key_rotation_days
                settings.project_master_key = legacy.project_master_key
                
                logger.info(f"Migrated encryption settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_backup_settings(self) -> ProjectBackupSettings:
        """
        Get backup settings from ProjectBackupSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectBackupSettings instance (created if doesn't exist)
        """
        settings = ProjectBackupSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectBackupSettings(project_id=self.project_id)
            
            if legacy:
                settings.auto_backup_enabled = legacy.auto_backup_enabled
                settings.backup_frequency_hours = legacy.backup_frequency_hours
                settings.backup_retention_days = legacy.backup_retention_days
                
                logger.info(f"Migrated backup settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_chat_settings(self) -> ProjectChatSettings:
        """
        Get chat settings from ProjectChatSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectChatSettings instance (created if doesn't exist)
        """
        settings = ProjectChatSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectChatSettings(project_id=self.project_id)
            
            if legacy:
                settings.chat_message_limit_per_minute = legacy.chat_message_limit_per_minute
                settings.chat_daily_message_limit = legacy.chat_daily_message_limit
                settings.chat_message_max_length = legacy.chat_message_max_length
                
                logger.info(f"Migrated chat settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_offline_auth_settings(self) -> ProjectOfflineAuthSettings:
        """
        Get offline auth settings from ProjectOfflineAuthSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectOfflineAuthSettings instance (created if doesn't exist)
        """
        settings = ProjectOfflineAuthSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectOfflineAuthSettings(project_id=self.project_id)
            
            if legacy:
                settings.offline_auth_enabled = legacy.offline_auth_enabled
                settings.offline_ticket_expiration_hours = legacy.offline_ticket_expiration_hours
                
                logger.info(f"Migrated offline auth settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_appearance_settings(self) -> ProjectAppearanceSettings:
        """
        Get appearance settings from ProjectAppearanceSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectAppearanceSettings instance (created if doesn't exist)
        """
        settings = ProjectAppearanceSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectAppearanceSettings(project_id=self.project_id)
            
            if legacy:
                settings.appearance_settings = legacy.appearance_settings
                
                logger.info(f"Migrated appearance settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_invite_settings(self) -> ProjectInviteSettings:
        """
        Get invite settings from ProjectInviteSettings with fallback to ProjectSettings.
        
        Returns:
            ProjectInviteSettings instance (created if doesn't exist)
        """
        settings = ProjectInviteSettings.query.filter_by(project_id=self.project_id).first()
        
        if not settings:
            legacy = self._get_legacy_settings()
            settings = ProjectInviteSettings(project_id=self.project_id)
            
            if legacy:
                settings.invite_code_required = legacy.invite_code_required
                
                logger.info(f"Migrated invite settings from ProjectSettings for project {self.project_id}")
            
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def get_project_master_key(self) -> Optional[str]:
        """
        Get project_master_key from ProjectEncryptionSettings with fallback to ProjectSettings.
        
        This is a convenience method for the most commonly accessed field.
        
        Returns:
            Project master key string or None
        """
        encryption_settings = self.get_encryption_settings()
        if encryption_settings.project_master_key:
            return encryption_settings.project_master_key
        
        # Fallback to legacy
        legacy = self._get_legacy_settings()
        if legacy and legacy.project_master_key:
            # Migrate it
            encryption_settings.project_master_key = legacy.project_master_key
            db.session.commit()
            return encryption_settings.project_master_key
        
        return None


def migrate_project_settings(project_id: int) -> Dict[str, bool]:
    """
    Migrate all settings from ProjectSettings to specialized models for a project.
    
    This function creates specialized settings models and copies data from ProjectSettings.
    It's safe to call multiple times - it won't overwrite existing specialized settings.
    
    Args:
        project_id: Project ID to migrate
        
    Returns:
        Dict with migration status for each settings type
    """
    helper = ProjectSettingsHelper(project_id)
    results = {}
    
    try:
        helper.get_security_settings()
        results["security"] = True
    except Exception as e:
        logger.error(f"Failed to migrate security settings for project {project_id}: {e}")
        results["security"] = False
    
    try:
        helper.get_system_settings()
        results["system"] = True
    except Exception as e:
        logger.error(f"Failed to migrate system settings for project {project_id}: {e}")
        results["system"] = False
    
    try:
        helper.get_encryption_settings()
        results["encryption"] = True
    except Exception as e:
        logger.error(f"Failed to migrate encryption settings for project {project_id}: {e}")
        results["encryption"] = False
    
    try:
        helper.get_backup_settings()
        results["backup"] = True
    except Exception as e:
        logger.error(f"Failed to migrate backup settings for project {project_id}: {e}")
        results["backup"] = False
    
    try:
        helper.get_chat_settings()
        results["chat"] = True
    except Exception as e:
        logger.error(f"Failed to migrate chat settings for project {project_id}: {e}")
        results["chat"] = False
    
    try:
        helper.get_offline_auth_settings()
        results["offline_auth"] = True
    except Exception as e:
        logger.error(f"Failed to migrate offline auth settings for project {project_id}: {e}")
        results["offline_auth"] = False
    
    try:
        helper.get_appearance_settings()
        results["appearance"] = True
    except Exception as e:
        logger.error(f"Failed to migrate appearance settings for project {project_id}: {e}")
        results["appearance"] = False
    
    try:
        helper.get_invite_settings()
        results["invite"] = True
    except Exception as e:
        logger.error(f"Failed to migrate invite settings for project {project_id}: {e}")
        results["invite"] = False
    
    return results

