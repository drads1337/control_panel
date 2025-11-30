"""
Project-related models
Contains Project and all Project* settings models
"""

import random
import secrets
from datetime import datetime

from ..core.extensions import db
from .project_user import ProjectAdmin


def generate_unique_project_id():
    """Generate a unique 10-digit project ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(10)])

        existing_project = Project.query.filter_by(unique_id=unique_id).first()
        if not existing_project:
            return unique_id


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(10), unique=True, nullable=False)
    name = db.Column(db.String(128), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    logo_url = db.Column(db.String(256), nullable=True)
    status = db.Column(db.String(32), default="active")

    admin_id = db.Column(db.Integer, nullable=True)

    subscription_expires_at = db.Column(db.DateTime, nullable=True)
    subscription_status = db.Column(
        db.String(32), default="free"
    )

    original_subscription_expires_at = db.Column(db.DateTime, nullable=True)
    original_subscription_status = db.Column(db.String(32), nullable=True)

    storage_limit = db.Column(db.BigInteger, default=3221225472)

    total_users = db.Column(db.Integer, default=0, nullable=False)
    total_keys = db.Column(db.Integer, default=0, nullable=False)
    total_products = db.Column(db.Integer, default=0, nullable=False)
    total_servers = db.Column(db.Integer, default=0, nullable=False)
    active_users = db.Column(db.Integer, default=0, nullable=False)
    active_keys = db.Column(db.Integer, default=0, nullable=False)
    



    secret_key = db.Column(db.String(64), nullable=True, unique=True)

    def __init__(self, project_relationships_service=None, **kwargs):
        self._project_relationships_service = project_relationships_service
        super(Project, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_project_id()


        if not self.secret_key:

            self.secret_key = secrets.token_hex(32)

    @property
    def storage_limit_gb(self):
        """Get storage limit in GB"""
        if self.storage_limit is None:
            return 0.0
        return round(self.storage_limit / (1024**3), 2)

    @property
    def storage_limit_mb(self):
        """Get storage limit in MB"""
        if self.storage_limit is None:
            return 0.0
        return round(self.storage_limit / (1024**2), 2)

    @property
    def is_active(self):
        """Check if project is active and subscription is valid"""
        if self.status != "active":
            return False
        if self.subscription_expires_at and datetime.utcnow() > self.subscription_expires_at:
            return False
        return True

    @property
    def days_until_expiry(self):
        """Calculate days until subscription expires"""
        if not self.subscription_expires_at:
            return None
        delta = self.subscription_expires_at - datetime.utcnow()
        return max(0, delta.days)

    @property
    def subscription_status_display(self):
        """Get human-readable subscription status"""

        if self.status == "inactive":
            if self.subscription_expires_at:
                days_left = self.days_until_expiry
                if days_left <= 0:
                    return "expired"
                elif days_left <= 3:
                    return "expiring_soon"
                else:
                    return self.subscription_status
            return self.subscription_status

        if not self.is_active:
            return "expired"

        if self.subscription_expires_at:
            days_left = self.days_until_expiry
            if days_left <= 0:
                return "expired"
            elif days_left <= 3:
                return "expiring_soon"
            else:
                return self.subscription_status

        if self.subscription_status:
            return self.subscription_status

        return "free"

    @property
    def admin_user(self):
        """
        Get the project admin user
        
        NOTE: This property is kept for backward compatibility.
        For new code, use project_relationships_service.get_admin_user(project_id) instead.
        Uses DI through app context to get project_relationships_service.
        """

        if self._project_relationships_service:
            return self._project_relationships_service.get_admin_user(self.id)

        from flask import current_app
        if not hasattr(current_app, 'service_container'):
            raise RuntimeError(
                "Service container not initialized. Cannot get 'project_relationships_service'. "
                "Make sure init_services() was called during app initialization."
            )
        service = current_app.service_container.get('project_relationships_service')
        return service.get_admin_user(self.id)

    def set_admin(self, user_id):
        """
        Set project admin
        
        NOTE: This method is kept for backward compatibility.
        For new code, use project_relationships_service.set_admin(project_id, user_id) instead.
        """
        if self._project_relationships_service:
            return self._project_relationships_service.set_admin(self.id, user_id)

        from flask import current_app
        if not hasattr(current_app, 'service_container'):
            raise RuntimeError(
                "Service container not initialized. Cannot get 'project_relationships_service'. "
                "Make sure init_services() was called during app initialization."
            )
        service = current_app.service_container.get('project_relationships_service')
        return service.set_admin(self.id, user_id)

    def get_admin_id(self):
        """
        Get admin user ID (for backward compatibility)
        
        NOTE: This method is kept for backward compatibility.
        For new code, use project_relationships_service.get_admin_id(project_id) instead.
        """
        if self._project_relationships_service:
            return self._project_relationships_service.get_admin_id(self.id)

        from flask import current_app
        if not hasattr(current_app, 'service_container'):
            raise RuntimeError(
                "Service container not initialized. Cannot get 'project_relationships_service'. "
                "Make sure init_services() was called during app initialization."
            )
        service = current_app.service_container.get('project_relationships_service')
        return service.get_admin_id(self.id)


class ProjectEncryptionKeys(db.Model):
    """
    Model for storing unique encryption keys for each project.
    
    SECURITY: Supports Envelope Encryption (DEK/KEK pattern):
    - aes_key: Legacy plain-text key (for backward compatibility)
    - aes_key_encrypted: New encrypted DEK (encrypted with KEK from env)
    
    When both are present, encrypted key takes precedence.
    """
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="encryption_keys")


    aes_key = db.Column(db.Text, nullable=True)
    

    aes_key_encrypted = db.Column(db.Text, nullable=True)

    public_key_cert = db.Column(db.Text, nullable=False)

    private_key_encrypted = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    key_metadata = db.Column(db.Text, nullable=True)

    def get_aes_key(self) -> str:
        """
        Get decrypted AES key (DEK) for this project.
        
        SECURITY: Uses Envelope Encryption if available. No fallback to plain key allowed.
        If encrypted key exists, PROJECT_MASTER_KEY must be set and decryption must succeed.
        If decryption fails, this is a configuration error, not a reason to use plain key.
        
        Returns:
            AES key as hex string (64 characters)
            
        Raises:
            ValueError: If no key is available or decryption fails
        """
        from ..utils.envelope_encryption import EnvelopeKeyManager
        import logging
        logger = logging.getLogger(__name__)
        

        if self.aes_key_encrypted:
            if not EnvelopeKeyManager.validate_kek_set():
                raise ValueError(
                    f"Project {self.project_id} has encrypted key but PROJECT_MASTER_KEY is not set. "
                    f"This is a configuration error. "
                    f"Either set PROJECT_MASTER_KEY environment variable or migrate to plain key storage."
                )
            
            try:
                return EnvelopeKeyManager.decrypt_dek_string(self.aes_key_encrypted)
            except Exception as e:
                logger.error(
                    f"CRITICAL: Failed to decrypt DEK for project {self.project_id}: {e}. "
                    f"This is a configuration error - encrypted key exists but cannot be decrypted."
                )
                raise ValueError(
                    f"Failed to decrypt encrypted key for project {self.project_id}. "
                    f"This is a configuration error. "
                    f"Please ensure PROJECT_MASTER_KEY is correct or contact support."
                ) from e
        

        if self.aes_key:
            logger.warning(
                f"Project {self.project_id} using plain key (legacy). "
                f"Consider migrating to Envelope Encryption for better security."
            )
            return self.aes_key
        
        raise ValueError(
            f"No encryption key available for project {self.project_id}. "
            f"Please configure Cryptographic Keys (AES Key) in project settings."
        )
    
    def set_aes_key(self, plain_key: str, use_envelope: bool = True):
        """
        Set AES key for this project.
        
        By default, encrypts the key using Envelope Encryption (DEK/KEK).
        Falls back to plain storage if KEK is not available.
        
        Args:
            plain_key: Plain AES key as hex string (64 characters)
            use_envelope: Whether to use Envelope Encryption (default: True)
        """
        from ..utils.envelope_encryption import EnvelopeKeyManager
        

        if len(plain_key) != 64:
            raise ValueError(f"AES key must be 64 hex characters (32 bytes), got {len(plain_key)}")
        
        try:
            bytes.fromhex(plain_key)
        except ValueError as e:
            raise ValueError(f"Invalid AES key format: {e}") from e
        

        if use_envelope and EnvelopeKeyManager.validate_kek_set():
            try:
                self.aes_key_encrypted = EnvelopeKeyManager.encrypt_dek_string(plain_key)


                self.aes_key = plain_key
                return
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Failed to encrypt DEK for project {self.project_id}: {e}. "
                    f"Falling back to plain storage."
                )
        

        self.aes_key = plain_key

        self.aes_key_encrypted = None

    def __repr__(self):
        return f"<ProjectEncryptionKeys(project_id={self.project_id})>"


class ProjectSecuritySettings(db.Model):
    """Model for storing project security settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="security_settings")

    min_password_length = db.Column(db.Integer, default=8)
    max_login_attempts = db.Column(db.Integer, default=5)
    ip_block_duration_minutes = db.Column(db.Integer, default=15)
    max_sessions_per_user = db.Column(db.Integer, default=5)
    log_retention_days = db.Column(db.Integer, default=60)
    security_log_level = db.Column(db.String(20), default="warning")

    two_factor_auth_required = db.Column(db.Boolean, default=False)
    password_complexity_required = db.Column(db.Boolean, default=True)
    session_fingerprinting = db.Column(db.Boolean, default=True)
    ip_whitelist_enabled = db.Column(db.Boolean, default=False)
    ip_whitelist = db.Column(db.Text, nullable=True)
    rate_limiting_enabled = db.Column(db.Boolean, default=True)
    rate_limit_requests_per_minute = db.Column(db.Integer, default=60)
    vpn_blocking_enabled = db.Column(db.Boolean, default=False)
    security_logging_enabled = db.Column(db.Boolean, default=True)
    suspicious_activity_check_enabled = db.Column(db.Boolean, default=True)
    session_limiting_enabled = db.Column(db.Boolean, default=True)
    auto_log_cleanup_enabled = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectSecuritySettings(project_id={self.project_id})>"


class ProjectSystemSettings(db.Model):
    """Model for storing project system settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="system_settings")

    max_connections = db.Column(db.Integer, default=100)
    session_timeout_minutes = db.Column(db.Integer, default=30)
    log_file_size_mb = db.Column(db.Integer, default=100)
    system_log_level = db.Column(db.String(20), default="info")
    auto_save_enabled = db.Column(db.Boolean, default=True)
    analytics_enabled = db.Column(db.Boolean, default=False)
    system_notifications_enabled = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectSystemSettings(project_id={self.project_id})>"


class ProjectEncryptionSettings(db.Model):
    """Model for storing project encryption settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="encryption_settings")

    encryption_enabled = db.Column(db.Boolean, default=False)
    encryption_algorithm = db.Column(db.String(32), default="AES-256")
    key_rotation_days = db.Column(db.Integer, default=90)
    project_master_key = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectEncryptionSettings(project_id={self.project_id})>"


class ProjectBackupSettings(db.Model):
    """Model for storing project backup settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="backup_settings")

    auto_backup_enabled = db.Column(db.Boolean, default=False)
    backup_frequency_hours = db.Column(db.Integer, default=24)
    backup_retention_days = db.Column(db.Integer, default=30)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectBackupSettings(project_id={self.project_id})>"


class ProjectChatSettings(db.Model):
    """Model for storing project chat settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="chat_settings")

    chat_message_limit_per_minute = db.Column(db.Integer, default=30)
    chat_daily_message_limit = db.Column(db.Integer, default=1000)
    chat_message_max_length = db.Column(db.Integer, default=1000)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectChatSettings(project_id={self.project_id})>"


class ProjectOfflineAuthSettings(db.Model):
    """Model for storing project offline authentication settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="offline_auth_settings")

    offline_auth_enabled = db.Column(db.Boolean, default=False)
    offline_ticket_expiration_hours = db.Column(db.Integer, default=12)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectOfflineAuthSettings(project_id={self.project_id})>"


class ProjectAppearanceSettings(db.Model):
    """Model for storing project appearance settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="appearance_settings")

    appearance_settings = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectAppearanceSettings(project_id={self.project_id})>"


class ProjectInviteSettings(db.Model):
    """Model for storing project invite settings"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="invite_settings")

    invite_code_required = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectInviteSettings(project_id={self.project_id})>"




class ProjectSettings(db.Model):
    """
    DEPRECATED: This model is kept for backward compatibility.
    Use specific settings models instead:
    - ProjectSecuritySettings
    - ProjectSystemSettings
    - ProjectEncryptionSettings
    - ProjectBackupSettings
    - ProjectChatSettings
    - ProjectOfflineAuthSettings
    - ProjectAppearanceSettings
    - ProjectInviteSettings
    """

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="settings")



    min_password_length = db.Column(db.Integer, default=8)
    max_login_attempts = db.Column(db.Integer, default=5)
    ip_block_duration_minutes = db.Column(db.Integer, default=15)
    max_sessions_per_user = db.Column(db.Integer, default=5)
    log_retention_days = db.Column(db.Integer, default=60)
    security_log_level = db.Column(db.String(20), default="warning")
    max_connections = db.Column(db.Integer, default=100)
    session_timeout_minutes = db.Column(db.Integer, default=30)
    log_file_size_mb = db.Column(db.Integer, default=100)
    system_log_level = db.Column(db.String(20), default="info")
    auto_save_enabled = db.Column(db.Boolean, default=True)
    analytics_enabled = db.Column(db.Boolean, default=False)
    system_notifications_enabled = db.Column(db.Boolean, default=True)
    two_factor_auth_required = db.Column(db.Boolean, default=False)
    password_complexity_required = db.Column(db.Boolean, default=True)
    session_fingerprinting = db.Column(db.Boolean, default=True)
    ip_whitelist_enabled = db.Column(db.Boolean, default=False)
    ip_whitelist = db.Column(db.Text, nullable=True)
    rate_limiting_enabled = db.Column(db.Boolean, default=True)
    rate_limit_requests_per_minute = db.Column(db.Integer, default=60)
    vpn_blocking_enabled = db.Column(db.Boolean, default=False)
    security_logging_enabled = db.Column(db.Boolean, default=True)
    suspicious_activity_check_enabled = db.Column(db.Boolean, default=True)
    session_limiting_enabled = db.Column(db.Boolean, default=True)
    auto_log_cleanup_enabled = db.Column(db.Boolean, default=True)
    encryption_enabled = db.Column(db.Boolean, default=False)
    encryption_algorithm = db.Column(db.String(32), default="AES-256")
    key_rotation_days = db.Column(db.Integer, default=90)
    auto_backup_enabled = db.Column(db.Boolean, default=False)
    backup_frequency_hours = db.Column(db.Integer, default=24)
    backup_retention_days = db.Column(db.Integer, default=30)
    appearance_settings = db.Column(db.Text, nullable=True)
    project_master_key = db.Column(db.Text, nullable=True)
    invite_code_required = db.Column(db.Boolean, default=True)
    chat_message_limit_per_minute = db.Column(db.Integer, default=30)
    chat_daily_message_limit = db.Column(db.Integer, default=1000)
    chat_message_max_length = db.Column(db.Integer, default=1000)
    offline_auth_enabled = db.Column(db.Boolean, default=False)
    offline_ticket_expiration_hours = db.Column(db.Integer, default=12)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectSettings(project_id={self.project_id})>"


class ProjectInviteCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    used_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id"), nullable=True
    )
    created_by = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=True
    )
    project = db.relationship("Project", backref="invite_codes")
    admin = db.relationship("User", backref="created_invite_codes", foreign_keys=[created_by])

    auto_delete_at = db.Column(db.DateTime, nullable=True)
    is_expired = db.Column(db.Boolean, default=False)

    @property
    def is_valid(self):
        """Check if invite code is still valid"""
        if self.is_used or self.is_expired:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        if self.auto_delete_at and datetime.utcnow() > self.auto_delete_at:
            return False
        return True

    @property
    def days_until_expiry(self):
        """Calculate days until invite code expires"""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)

    @property
    def days_until_auto_delete(self):
        """Calculate days until auto-deletion"""
        if not self.auto_delete_at:
            return None
        delta = self.auto_delete_at - datetime.utcnow()
        return max(0, delta.days)