"""
Remote Control models for managing cheat/mod features
"""

import json
from datetime import datetime

from ..core.extensions import db


class RemoteCategory(db.Model):
    """Model for remote control categories (ESP, Aimbot, Misc, etc.)"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    description = db.Column(db.Text, nullable=True)
    color = db.Column(db.String(7), default="#3b82f6")  # Hex color code
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="remote_categories")

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: category name must be unique within a project
    __table_args__ = (
        db.UniqueConstraint("name", "project_id", name="uq_remote_category_name_project"),
    )

    def to_dict(self):
        """Convert model to dictionary for JSON response"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RemoteCategory {self.name} (project_id={self.project_id})>"


class RemoteFeature(db.Model):
    """Model for remote control features (Player ESP, Smooth Aimbot, etc.)"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    enabled = db.Column(db.Boolean, default=False)
    category_id = db.Column(
        db.Integer, db.ForeignKey("remote_category.id", ondelete="CASCADE"), nullable=False
    )
    category = db.relationship("RemoteCategory", backref="features")
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="remote_features")

    # Feature configuration (JSON string for additional settings)
    configuration = db.Column(db.Text, nullable=True)  # JSON string

    # Status tracking
    status = db.Column(db.String(16), default="offline")  # online, offline, error

    # Usage statistics
    usage_count = db.Column(db.Integer, default=0)
    last_used_at = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: feature name must be unique within a project
    __table_args__ = (
        db.UniqueConstraint("name", "project_id", name="uq_remote_feature_name_project"),
    )

    def get_configuration(self):
        """Get configuration as dictionary"""
        if self.configuration:
            try:
                return json.loads(self.configuration)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_configuration(self, config_dict):
        """Set configuration from dictionary"""
        if config_dict:
            self.configuration = json.dumps(config_dict)
        else:
            self.configuration = None

    def to_dict(self):
        """Convert model to dictionary for JSON response"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "enabled": self.enabled,
            "category": str(self.category_id),
            "status": self.status,
            "configuration": self.get_configuration(),
            "usage_count": self.usage_count,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RemoteFeature {self.name} (category_id={self.category_id}, project_id={self.project_id})>"


class RemoteFeatureLog(db.Model):
    """Model for logging remote feature usage and changes"""

    id = db.Column(db.Integer, primary_key=True)
    feature_id = db.Column(
        db.Integer, db.ForeignKey("remote_feature.id", ondelete="CASCADE"), nullable=False
    )
    feature = db.relationship("RemoteFeature", backref="logs")
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="remote_feature_logs")

    # Action details
    action = db.Column(db.String(64), nullable=False)  # enabled, disabled, configured, used
    details = db.Column(db.Text, nullable=True)  # Additional details about the action

    # User who performed the action (if applicable)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    user = db.relationship("User", backref="remote_feature_actions")

    # Client information (if action was from a client)
    client_ip = db.Column(db.String(64), nullable=True)
    client_user_agent = db.Column(db.String(512), nullable=True)

    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert model to dictionary for JSON response"""
        return {
            "id": self.id,
            "feature_id": self.feature_id,
            "action": self.action,
            "details": self.details,
            "user_id": self.user_id,
            "client_ip": self.client_ip,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<RemoteFeatureLog {self.action} for feature {self.feature_id}>"
