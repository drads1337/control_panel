"""
Settings Repository
Handles all database operations for project settings and encryption keys.

Single Responsibility: Database access layer for settings.
"""

import json
import logging
import secrets
from datetime import datetime
from typing import Dict, Optional

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from ...core.extensions import db
from ...models.core import Project, ProjectEncryptionKeys, User
from ...utils.project_settings_migration import ProjectSettingsHelper

logger = logging.getLogger(__name__)

class SettingsRepository:
    """
    Repository for project settings database operations.
    
    Single Responsibility: Handle all database CRUD operations for settings.
    """

    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        try:
            return User.query.get(user_id)
        except Exception as e:
            logger.error(f"Database error querying user {user_id}: {e}")
            raise

    def get_project(self, project_id: int) -> Optional[Project]:
        """Get project by ID"""
        try:
            return Project.query.get(project_id)
        except Exception as e:
            logger.error(f"Database error querying project {project_id}: {e}")
            raise

    def get_first_available_project(self, active_only: bool = True) -> Optional[Project]:
        """Get first available project (for owners without project_id)"""
        try:
            if active_only:
                return Project.query.filter_by(is_active=True).order_by(Project.id.asc()).first()
            return Project.query.order_by(Project.id.asc()).first()
        except Exception as e:
            logger.error(f"Error looking up projects: {e}")
            raise

    def get_project_settings_helper(self, project_id: int) -> ProjectSettingsHelper:
        """
        Get ProjectSettingsHelper for accessing specialized settings models.
        
        Returns:
            ProjectSettingsHelper instance
        """
        return ProjectSettingsHelper(project_id)
    
    def get_all_project_settings(self, project_id: int) -> Dict:
        """
        Get all project settings as a dictionary (aggregated from specialized models).
        
        This method aggregates all specialized settings into a single dictionary
        for backward compatibility with code that expects a single settings object.
        
        Returns:
            Dictionary with all settings organized by category
        """
        helper = ProjectSettingsHelper(project_id)
        
        security = helper.get_security_settings()
        system = helper.get_system_settings()
        encryption = helper.get_encryption_settings()
        backup = helper.get_backup_settings()
        chat = helper.get_chat_settings()
        offline_auth = helper.get_offline_auth_settings()
        appearance = helper.get_appearance_settings()
        invite = helper.get_invite_settings()
        

        class AggregatedSettings:
            """Aggregated settings object that provides attribute access like ProjectSettings"""
            def __init__(self):

                self.min_password_length = security.min_password_length
                self.max_login_attempts = security.max_login_attempts
                self.ip_block_duration_minutes = security.ip_block_duration_minutes
                self.max_sessions_per_user = security.max_sessions_per_user
                self.log_retention_days = security.log_retention_days
                self.security_log_level = security.security_log_level
                self.two_factor_auth_required = security.two_factor_auth_required
                self.password_complexity_required = security.password_complexity_required
                self.session_fingerprinting = security.session_fingerprinting
                self.ip_whitelist_enabled = security.ip_whitelist_enabled
                self.ip_whitelist = security.ip_whitelist
                self.rate_limiting_enabled = security.rate_limiting_enabled
                self.rate_limit_requests_per_minute = security.rate_limit_requests_per_minute
                self.vpn_blocking_enabled = security.vpn_blocking_enabled
                self.security_logging_enabled = security.security_logging_enabled
                self.suspicious_activity_check_enabled = security.suspicious_activity_check_enabled
                self.session_limiting_enabled = security.session_limiting_enabled
                self.auto_log_cleanup_enabled = security.auto_log_cleanup_enabled
                

                self.max_connections = system.max_connections
                self.session_timeout_minutes = system.session_timeout_minutes
                self.log_file_size_mb = system.log_file_size_mb
                self.system_log_level = system.system_log_level
                self.auto_save_enabled = system.auto_save_enabled
                self.analytics_enabled = system.analytics_enabled
                self.system_notifications_enabled = system.system_notifications_enabled
                

                self.encryption_enabled = encryption.encryption_enabled
                self.encryption_algorithm = encryption.encryption_algorithm
                self.key_rotation_days = encryption.key_rotation_days
                self.project_master_key = encryption.project_master_key
                

                self.auto_backup_enabled = backup.auto_backup_enabled
                self.backup_frequency_hours = backup.backup_frequency_hours
                self.backup_retention_days = backup.backup_retention_days
                

                self.chat_message_limit_per_minute = chat.chat_message_limit_per_minute
                self.chat_daily_message_limit = chat.chat_daily_message_limit
                self.chat_message_max_length = chat.chat_message_max_length
                

                self.offline_auth_enabled = offline_auth.offline_auth_enabled
                self.offline_ticket_expiration_hours = offline_auth.offline_ticket_expiration_hours
                

                self.appearance_settings = appearance.appearance_settings
                

                self.invite_code_required = invite.invite_code_required
        
        return AggregatedSettings()

    def get_or_create_project_settings(self, project_id: int):
        """
        Get or create all project settings (aggregated from specialized models).
        
        Returns:
            AggregatedSettings object with all settings
        """
        return self.get_all_project_settings(project_id)

    def get_project_encryption_keys(self, project_id: int) -> Optional[ProjectEncryptionKeys]:
        """Get project encryption keys"""
        try:
            return ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()
        except Exception as e:
            logger.error(f"Error getting encryption keys for project_id {project_id}: {e}")
            return None

    def create_project_encryption_keys(self, project_id: int) -> ProjectEncryptionKeys:
        """Create project encryption keys"""
        try:
            private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=2048, backend=default_backend()
            )
            public_key = private_key.public_key()

            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode("utf-8")

            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("utf-8")

            keys = ProjectEncryptionKeys(
                project_id=project_id,
                aes_key=secrets.token_hex(32),
                public_key_cert=public_pem,
                private_key_encrypted=private_pem,
                key_metadata=json.dumps(
                    {"algorithm": "RSA", "key_size": 2048, "aes_key_size": 256}
                ),
                created_at=datetime.utcnow(),
            )
            db.session.add(keys)
            db.session.commit()
            logger.info(f"Created new keys for project_id: {project_id}")
            return keys
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating encryption keys for project_id {project_id}: {e}")
            raise

    def get_or_create_project_encryption_keys(self, project_id: int) -> Dict[str, str]:
        """Get or create project encryption keys, returns dict with aes_key and public_key"""
        try:
            keys = self.get_project_encryption_keys(project_id)
            if not keys:
                keys = self.create_project_encryption_keys(project_id)
            
            if not keys:
                return {"aes_key": "", "public_key": ""}
            
            return {
                "aes_key": keys.aes_key or "",
                "public_key": keys.public_key_cert or "",
            }
        except Exception as e:
            logger.error(f"Error in get_or_create_project_encryption_keys for project_id {project_id}: {e}")

            return {"aes_key": "", "public_key": ""}

