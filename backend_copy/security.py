"""
Security-related models
"""

from datetime import datetime

from ..core.extensions import db

class TwoFactorAuth(db.Model):
    """Model for storing 2FA settings and secrets for users"""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    user = db.relationship("User", backref="two_factor_auth")

    is_enabled = db.Column(db.Boolean, default=False)
    secret_key = db.Column(db.String(32), nullable=True)
    backup_codes = db.Column(db.Text, nullable=True)

    recovery_email = db.Column(db.String(120), nullable=True)
    recovery_phone = db.Column(db.String(20), nullable=True)

    last_used_backup_code = db.Column(db.String(10), nullable=True)
    failed_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used = db.Column(db.DateTime, nullable=True)

    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="two_factor_auths")

    def __repr__(self):
        return f"<TwoFactorAuth user_id={self.user_id} enabled={self.is_enabled}>"

class TwoFactorSession(db.Model):
    """Model for tracking 2FA sessions and temporary tokens"""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    user = db.relationship("User", backref="two_factor_sessions")

    session_token = db.Column(db.String(64), nullable=False, unique=True)
    temp_token = db.Column(
        db.String(64), nullable=True
    )
    is_verified = db.Column(db.Boolean, default=False)

    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    device_fingerprint = db.Column(db.String(256), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    verified_at = db.Column(db.DateTime, nullable=True)

    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="two_factor_sessions")

    def __repr__(self):
        return f"<TwoFactorSession user_id={self.user_id} verified={self.is_verified}>"

class TwoFactorBackupCode(db.Model):
    """Model for storing individual backup codes"""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    user = db.relationship("User", backref="two_factor_backup_codes")

    code_hash = db.Column(db.String(64), nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime, nullable=True)

    used_from_ip = db.Column(db.String(64), nullable=True)
    used_from_user_agent = db.Column(db.String(512), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="two_factor_backup_codes")

    def __repr__(self):
        return f"<TwoFactorBackupCode user_id={self.user_id} used={self.is_used}>"

class LoginAttempt(db.Model):
    """Model for tracking login attempts and IP blocking"""

    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(64), nullable=False)
    username = db.Column(db.String(128), nullable=True)
    success = db.Column(db.Boolean, default=False)
    user_agent = db.Column(db.String(512), nullable=True)
    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="login_attempts")

class BlockedFingerprint(db.Model):
    """Enhanced model for tracking blocked device fingerprints with advanced security features"""

    id = db.Column(db.Integer, primary_key=True)
    fingerprint = db.Column(db.String(256), nullable=False)
    reason = db.Column(db.String(256), nullable=False)
    blocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="blocked_fingerprints")

    block_type = db.Column(
        db.String(32), default="manual"
    )
    severity = db.Column(db.String(16), default="medium")
    threat_score = db.Column(db.Integer, default=0)
    source_ip = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)

    attempt_count = db.Column(db.Integer, default=1)
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    associated_keys = db.Column(db.Text, nullable=True)

    auto_unblock_enabled = db.Column(db.Boolean, default=False)
    unblock_conditions = db.Column(db.Text, nullable=True)

    blocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    blocked_by_user = db.relationship("User", foreign_keys=[blocked_by_user_id])
    unblocked_at = db.Column(db.DateTime, nullable=True)
    unblocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    unblocked_by_user = db.relationship("User", foreign_keys=[unblocked_by_user_id])

    extra_data = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "fingerprint", "project_id", name="blocked_fingerprint_fingerprint_project_key"
        ),
    )

class SecurityRule(db.Model):
    """Model for automated security rules and policies"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    rule_type = db.Column(
        db.String(32), nullable=False
    )

    conditions = db.Column(db.Text, nullable=False)

    action_type = db.Column(db.String(32), nullable=False)
    action_params = db.Column(db.Text, nullable=True)

    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=100)
    cooldown_minutes = db.Column(db.Integer, default=60)

    trigger_count = db.Column(db.Integer, default=0)
    last_triggered = db.Column(db.DateTime, nullable=True)

    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_by_user = db.relationship("User", foreign_keys=[created_by_user_id])
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="security_rules")

class BlockedIP(db.Model):
    """Model for tracking blocked IP addresses"""

    __tablename__ = "blockedip"
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), nullable=False)
    reason = db.Column(db.String(256), nullable=False)
    blocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="blocked_ips")

    block_type = db.Column(
        db.String(32), default="manual"
    )
    category = db.Column(
        db.String(64), default="general"
    )
    severity = db.Column(db.String(16), default="medium")
    threat_score = db.Column(db.Integer, default=0)
    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)

    attempt_count = db.Column(db.Integer, default=1)
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)

    auto_unblock_enabled = db.Column(db.Boolean, default=False)
    unblock_conditions = db.Column(db.Text, nullable=True)

    blocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    blocked_by_user = db.relationship("User", foreign_keys=[blocked_by_user_id])
    unblocked_at = db.Column(db.DateTime, nullable=True)
    unblocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    unblocked_by_user = db.relationship("User", foreign_keys=[unblocked_by_user_id])

    extra_data = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("ip_address", "project_id", name="blocked_ip_address_project_key"),
    )

class BlockedHWID(db.Model):
    """Model for tracking blocked hardware IDs"""

    __tablename__ = "blockedhwid"
    id = db.Column(db.Integer, primary_key=True)
    hwid = db.Column(db.String(256), nullable=False)
    reason = db.Column(db.String(256), nullable=False)
    blocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="blocked_hwids")

    block_type = db.Column(
        db.String(32), default="manual"
    )
    category = db.Column(
        db.String(64), default="general"
    )
    severity = db.Column(db.String(16), default="medium")
    threat_score = db.Column(db.Integer, default=0)

    cpu_info = db.Column(db.String(256), nullable=True)
    gpu_info = db.Column(db.String(256), nullable=True)
    motherboard_info = db.Column(db.String(256), nullable=True)
    ram_info = db.Column(db.String(256), nullable=True)

    attempt_count = db.Column(db.Integer, default=1)
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    associated_ips = db.Column(db.Text, nullable=True)

    auto_unblock_enabled = db.Column(db.Boolean, default=False)
    unblock_conditions = db.Column(db.Text, nullable=True)

    blocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    blocked_by_user = db.relationship("User", foreign_keys=[blocked_by_user_id])
    unblocked_at = db.Column(db.DateTime, nullable=True)
    unblocked_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    unblocked_by_user = db.relationship("User", foreign_keys=[unblocked_by_user_id])

    extra_data = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("hwid", "project_id", name="blocked_hwid_hwid_project_key"),
    )

class SecurityEvent(db.Model):
    """Model for logging security events and incidents"""

    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(
        db.String(64), nullable=False
    )
    severity = db.Column(db.String(16), default="medium")

    fingerprint = db.Column(db.String(256), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    user_key = db.Column(db.String(128), nullable=True)

    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)

    description = db.Column(db.Text, nullable=True)
    details = db.Column(db.Text, nullable=True)
    threat_score = db.Column(db.Integer, default=0)

    related_rule_id = db.Column(db.Integer, db.ForeignKey("security_rule.id"), nullable=True)
    related_rule = db.relationship("SecurityRule")
    related_fingerprint_id = db.Column(
        db.Integer, db.ForeignKey("blocked_fingerprint.id"), nullable=True
    )
    related_fingerprint = db.relationship("BlockedFingerprint")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="security_events")

class SecurityAnalytics(db.Model):
    """Model for security analytics and statistics"""

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    metric_type = db.Column(
        db.String(64), nullable=False
    )

    total_count = db.Column(db.Integer, default=0)
    unique_count = db.Column(db.Integer, default=0)
    blocked_count = db.Column(db.Integer, default=0)
    threat_score_avg = db.Column(db.Float, default=0.0)

    geo_breakdown = db.Column(db.Text, nullable=True)

    additional_metrics = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="security_analytics")
