"""
User-related models
Contains User, UserActivity, UserActionLog, and permission models
"""

import random
from datetime import datetime

from ..core.extensions import SensitiveDataMixin, db


def generate_unique_user_id():
    """Generate a unique 9-digit user ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(9)])
        
        existing_user = User.query.filter_by(unique_id=unique_id).first()
        if not existing_user:
            return unique_id


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

