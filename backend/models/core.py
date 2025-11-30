"""
Core models - Project, User, and system-related models
"""

import json
import random
import secrets
from datetime import datetime, timedelta

from ..core.extensions import SensitiveDataMixin, db

# Import ProjectAdmin at module level to avoid lazy imports
# This is safe because project_user.py doesn't import from core.py,
# it only uses string references in SQLAlchemy relationships
from .project_user import ProjectAdmin

def generate_unique_project_id():
    """Generate a unique 10-digit project ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(10)])

        existing_project = Project.query.filter_by(unique_id=unique_id).first()
        if not existing_project:
            return unique_id

def generate_unique_user_id():
    """Generate a unique 9-digit user ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(9)])
        
        existing_user = User.query.filter_by(unique_id=unique_id).first()
        if not existing_user:
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
        db.String(32), default="trial"
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
    
    # SECURITY: Per-project secret key for token generation
    # This replaces TOKEN_STATIC_WORD to ensure each project has unique token salts
    # If compromised, only tokens for this specific project are affected
    secret_key = db.Column(db.String(64), nullable=True, unique=True)

    def __init__(self, project_relationships_service=None, **kwargs):
        self._project_relationships_service = project_relationships_service
        super(Project, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_project_id()
        # SECURITY: Generate unique secret_key for token generation if not provided
        # This ensures each project has its own token salt, preventing cross-project token attacks
        if not self.secret_key:
            # Generate a secure 32-byte (64 hex characters) secret key
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

        return "trial"

    @property
    def admin_user(self):
        """
        Get the project admin user
        
        NOTE: This property is kept for backward compatibility.
        project_relationships_service = get_service('project_relationships_service')
        For new code, use project_relationships_service.get_admin_user(project_id) instead.
        """
        # Use service to avoid code duplication
        if self._project_relationships_service:
            return self._project_relationships_service.get_admin_user(self.id)
        from ..utils.service_helpers import get_service
        return get_service('project_relationships_service').get_admin_user(self.id)

    def set_admin(self, user_id):
        """
        Set project admin
        
        NOTE: This method is kept for backward compatibility.
        For new code, use project_relationships_service.set_admin(project_id, user_id) instead.
        """
        if self._project_relationships_service:
            return self._project_relationships_service.set_admin(self.id, user_id)
        from ..utils.service_helpers import get_service
        return get_service('project_relationships_service').set_admin(self.id, user_id)

    def get_admin_id(self):
        """
        Get admin user ID (for backward compatibility)
        
        NOTE: This method is kept for backward compatibility.
        For new code, use project_relationships_service.get_admin_id(project_id) instead.
        """
        if self._project_relationships_service:
            return self._project_relationships_service.get_admin_id(self.id)
        from ..utils.service_helpers import get_service
        return get_service('project_relationships_service').get_admin_id(self.id)

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

    # Legacy: Plain-text key (deprecated, kept for backward compatibility)
    aes_key = db.Column(db.Text, nullable=True)
    
    # New: Encrypted DEK (encrypted with KEK from PROJECT_MASTER_KEY env)
    aes_key_encrypted = db.Column(db.Text, nullable=True)

    public_key_cert = db.Column(db.Text, nullable=False)

    private_key_encrypted = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    key_metadata = db.Column(db.Text, nullable=True)

    def get_aes_key(self) -> str:
        """
        Get decrypted AES key (DEK) for this project.
        
        Uses Envelope Encryption if available, falls back to plain key for backward compatibility.
        
        Returns:
            AES key as hex string (64 characters)
            
        Raises:
            ValueError: If no key is available
        """
        from ..utils.envelope_encryption import EnvelopeKeyManager
        
        # Try Envelope Encryption first (new secure method)
        if self.aes_key_encrypted:
            try:
                if EnvelopeKeyManager.validate_kek_set():
                    return EnvelopeKeyManager.decrypt_dek_string(self.aes_key_encrypted)
                else:
                    # KEK not set, but encrypted key exists - log warning
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"Encrypted key exists for project {self.project_id} but PROJECT_MASTER_KEY not set. "
                        f"Falling back to plain key if available."
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Failed to decrypt DEK for project {self.project_id}: {e}. "
                    f"Falling back to plain key if available."
                )
        
        # Fallback to plain key (legacy behavior)
        if self.aes_key:
            return self.aes_key
        
        raise ValueError(f"No encryption key available for project {self.project_id}")
    
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
        
        # Validate key format
        if len(plain_key) != 64:
            raise ValueError(f"AES key must be 64 hex characters (32 bytes), got {len(plain_key)}")
        
        try:
            bytes.fromhex(plain_key)  # Validate hex format
        except ValueError as e:
            raise ValueError(f"Invalid AES key format: {e}") from e
        
        # Try Envelope Encryption first
        if use_envelope and EnvelopeKeyManager.validate_kek_set():
            try:
                self.aes_key_encrypted = EnvelopeKeyManager.encrypt_dek_string(plain_key)
                # Keep plain key for backward compatibility during migration period
                # TODO: Remove after full migration
                self.aes_key = plain_key
                return
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Failed to encrypt DEK for project {self.project_id}: {e}. "
                    f"Falling back to plain storage."
                )
        
        # Fallback to plain storage (legacy behavior)
        self.aes_key = plain_key
        # Clear encrypted key if we're using plain storage
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

# Backward compatibility: Keep ProjectSettings as a view/alias that aggregates all settings
# This allows gradual migration of existing code
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

    # All fields are deprecated - use specific settings models instead
    # These are kept for backward compatibility during migration
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

class User(SensitiveDataMixin, db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(9), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    referral_code = db.Column(db.String(32), unique=True)
    invited_by = db.Column(db.Integer, db.ForeignKey("user.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    avatar = db.Column(db.String(256), nullable=True)
    first_name = db.Column(db.String(64), nullable=True)
    last_name = db.Column(db.String(64), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    email = db.Column(db.String(120), nullable=True)
    last_ip = db.Column(db.String(64), nullable=True)
    last_country = db.Column(db.String(64), nullable=True)
    last_city = db.Column(db.String(64), nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    total_keys_generated = db.Column(db.Integer, default=0)

    token_balance = db.Column(db.BigInteger, default=0)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="users", foreign_keys=[project_id])

    total_keys = db.Column(db.Integer, default=0, nullable=False)
    active_keys = db.Column(db.Integer, default=0, nullable=False)

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_user_id()

    @property
    def is_active(self):
        """Check if user is active (not expired)"""
        if self.expires_at is None:
            return True
        return datetime.utcnow() < self.expires_at

class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    action = db.Column(db.String(128), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True, index=True)
    project = db.relationship("Project", backref="user_activities")
    details = db.Column(db.Text, nullable=True)
    session_id = db.Column(db.String(128), nullable=True)

    user = db.relationship("User", backref="activities")
    
    # Composite index for common query patterns: filtering by project and date range
    __table_args__ = (
        db.Index("idx_user_activity_project_created", "project_id", "created_at"),
        db.Index("idx_user_activity_user_created", "user_id", "created_at"),
    )

    def to_dict(self):
        """Convert model to dictionary for JSON response"""
        return {
            "id": self.id,
            "action": self.action,
            "ip_address": self.ip_address,
            "country": self.country,
            "city": self.city,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "details": self.details,
            "user_agent": self.user_agent,
            "session_id": self.session_id,
        }

class UserActionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True, index=True)
    action = db.Column(db.String(256), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    user = db.relationship("User", backref="action_logs")
    project = db.relationship("Project", backref="action_logs")
    
    # Composite index for common query patterns
    __table_args__ = (
        db.Index("idx_user_action_log_project_created", "project_id", "created_at"),
        db.Index("idx_user_action_log_user_created", "user_id", "created_at"),
    )

class UserProductPermission(db.Model):
    __tablename__ = "user_product_permission"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"))
    can_generate_keys = db.Column(db.Boolean, default=False)
    max_keys_per_day = db.Column(db.Integer, default=0)
    has_access = db.Column(
        db.Boolean, default=False
    )
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id"), nullable=True
    )
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    granted_by = db.Column(
        db.String(50), default="admin"
    )
    access_code = db.Column(
        db.String(255), nullable=True
    )
    user = db.relationship("User", backref="product_permissions")
    project = db.relationship("Project", backref="user_product_permissions")
    product = db.relationship("Product", backref="user_permissions", foreign_keys=[product_id])
    __table_args__ = (db.UniqueConstraint("user_id", "product_id", name="uq_user_product_permission"),)

class DeveloperProductPermission(db.Model):
    __tablename__ = "developer_product_permission"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"))
    __table_args__ = (db.UniqueConstraint("user_id", "product_id", name="uq_developer_product"),)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id"), nullable=True
    )
    project = db.relationship("Project", backref="developer_product_permissions")
    product = db.relationship("Product", backref="developer_permissions", foreign_keys=[product_id])

# Backward compatibility aliases
UserProductPermission = UserProductPermission
DeveloperProductPermission = DeveloperProductPermission

class SystemSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(128), unique=True, nullable=False)
    setting_value = db.Column(db.Text, nullable=True)
    setting_type = db.Column(db.String(32), default="string")
    category = db.Column(
        db.String(64), nullable=False
    )
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class APIKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    key_hash = db.Column(db.String(256), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime, nullable=True)
    permissions = db.Column(db.Text, nullable=True)
    creator = db.relationship("User", backref="created_api_keys")

class SystemBackup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    backup_type = db.Column(db.String(32), default="full")
    status = db.Column(db.String(32), default="completed")
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    creator = db.relationship("User", backref="created_backups")

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
