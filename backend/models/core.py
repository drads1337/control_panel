"""
Core models - Project, User, and system-related models
"""

import json
import random
from datetime import datetime, timedelta

from ..core.extensions import db

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
        db.String(32), default="trial"
    )

    original_subscription_expires_at = db.Column(db.DateTime, nullable=True)
    original_subscription_status = db.Column(db.String(32), nullable=True)

    storage_limit = db.Column(db.BigInteger, default=3221225472)

    total_users = db.Column(db.Integer, default=0, nullable=False)
    total_keys = db.Column(db.Integer, default=0, nullable=False)
    total_games = db.Column(db.Integer, default=0, nullable=False)
    total_servers = db.Column(db.Integer, default=0, nullable=False)
    active_users = db.Column(db.Integer, default=0, nullable=False)
    active_keys = db.Column(db.Integer, default=0, nullable=False)

    def __init__(self, **kwargs):
        super(Project, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_project_id()

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
        """Get the project admin user"""
        from .project_user import ProjectAdmin

        admin_record = ProjectAdmin.query.filter_by(project_id=self.id).first()
        if admin_record and admin_record.admin_user_id:
            from .core import User

            return User.query.get(admin_record.admin_user_id)
        return None

    def set_admin(self, user_id):
        """Set project admin"""
        from .project_user import ProjectAdmin

        admin_record = ProjectAdmin.query.filter_by(project_id=self.id).first()
        if not admin_record:
            admin_record = ProjectAdmin(project_id=self.id)
            db.session.add(admin_record)

        admin_record.admin_user_id = user_id
        db.session.commit()

    def get_admin_id(self):
        """Get admin user ID (for backward compatibility)"""
        from .project_user import ProjectAdmin

        admin_record = ProjectAdmin.query.filter_by(project_id=self.id).first()
        return admin_record.admin_user_id if admin_record else None

class ProjectEncryptionKeys(db.Model):
    """Model for storing unique encryption keys for each project"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project = db.relationship("Project", backref="encryption_keys")

    aes_key = db.Column(db.Text, nullable=False)

    public_key_cert = db.Column(db.Text, nullable=False)

    private_key_encrypted = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    key_metadata = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<ProjectEncryptionKeys(project_id={self.project_id})>"

class ProjectSettings(db.Model):
    """Model for storing project-specific settings"""

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
    rate_limit_requests_per_minute = db.Column(
        db.Integer, default=60
    )
    vpn_blocking_enabled = db.Column(db.Boolean, default=False)
    security_logging_enabled = db.Column(db.Boolean, default=True)
    suspicious_activity_check_enabled = db.Column(
        db.Boolean, default=True
    )
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

    invite_code_required = db.Column(
        db.Boolean, default=True
    )

    chat_message_limit_per_minute = db.Column(db.Integer, default=30)
    chat_daily_message_limit = db.Column(db.Integer, default=1000)
    chat_message_max_length = db.Column(db.Integer, default=1000)

    offline_auth_enabled = db.Column(db.Boolean, default=False)
    offline_ticket_expiration_hours = db.Column(db.Integer, default=12)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProjectSettings(project_id={self.project_id})>"

class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    referral_code = db.Column(db.String(32), unique=True)
    invited_by = db.Column(db.Integer, db.ForeignKey("user.id"))
    role = db.Column(db.String(32), default="seller")
    is_admin = db.Column(db.Boolean, default=False)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="user_activities")
    details = db.Column(db.Text, nullable=True)
    session_id = db.Column(db.String(128), nullable=True)

    user = db.relationship("User", backref="activities")

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
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    action = db.Column(db.String(256), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship("User", backref="action_logs")
    project = db.relationship("Project", backref="action_logs")

class UserGamePermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"))
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
    user = db.relationship("User", backref="game_permissions")
    project = db.relationship("Project", backref="user_game_permissions")
    __table_args__ = (db.UniqueConstraint("user_id", "game_id", name="uq_user_game_permission"),)

class DeveloperGamePermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"))
    __table_args__ = (db.UniqueConstraint("user_id", "game_id", name="uq_developer_game"),)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id"), nullable=True
    )
    project = db.relationship("Project", backref="developer_game_permissions")

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
