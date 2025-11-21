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
    color = db.Column(db.String(7), default="#3b82f6")
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="remote_categories")
    product_id = db.Column(
        db.Integer, db.ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    product = db.relationship("Product", backref="remote_categories")  # Using Product instead of Product

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("name", "project_id", "product_id", name="uq_remote_category_name_project_product"),
    )

    def to_dict(self):
        """Convert model to dictionary for JSON response"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "product_id": str(self.product_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RemoteCategory {self.name} (project_id={self.project_id}, product_id={self.product_id})>"

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
    product_id = db.Column(
        db.Integer, db.ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    product = db.relationship("Product", backref="remote_features")  # Using Product instead of Product

    configuration = db.Column(db.Text, nullable=True)

    status = db.Column(db.String(16), default="offline")

    usage_count = db.Column(db.Integer, default=0)
    last_used_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("name", "project_id", "product_id", name="uq_remote_feature_name_project_product"),
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
            "product_id": str(self.product_id),
            "status": self.status,
            "configuration": self.get_configuration(),
            "usage_count": self.usage_count,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RemoteFeature {self.name} (category_id={self.category_id}, project_id={self.project_id}, product_id={self.product_id})>"

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

    action = db.Column(db.String(64), nullable=False)
    details = db.Column(db.Text, nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    user = db.relationship("User", backref="remote_feature_actions")

    client_ip = db.Column(db.String(64), nullable=True)
    client_user_agent = db.Column(db.String(512), nullable=True)

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
