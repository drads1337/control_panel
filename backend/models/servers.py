"""
Server-related models
SECURITY FIX: Added encryption for sensitive server data
"""

from datetime import datetime

from ..core.extensions import db
from ..utils.secure_crypto import MasterKeyManager


class Server(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    ip_address = db.Column(db.String(128), nullable=False)
    port = db.Column(db.Integer, default=22)
    username = db.Column(db.String(128), nullable=False)
    # SECURITY FIX: Password is now encrypted using project master key
    password = db.Column(db.Text, nullable=False)  # Changed to Text to store encrypted data
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    status = db.Column(db.String(32), default="offline")  # online, offline, starting, stopping
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="servers")

    def set_password(self, plain_password: str, project_master_key: str):
        """
        SECURITY FIX: Encrypt password before storing in database.
        Uses project-specific master key for encryption.
        """
        if not plain_password:
            raise ValueError("Password cannot be empty")
        if not project_master_key:
            raise ValueError("Project master key is required for encryption")

        self.password = MasterKeyManager.encrypt_with_master_key(plain_password, project_master_key)

    def get_password(self, project_master_key: str) -> str:
        """
        SECURITY FIX: Decrypt password when retrieving from database.
        Uses project-specific master key for decryption.
        """
        if not self.password:
            return ""
        if not project_master_key:
            raise ValueError("Project master key is required for decryption")

        try:
            return MasterKeyManager.decrypt_with_master_key(self.password, project_master_key)
        except Exception as e:
            raise ValueError(f"Failed to decrypt password: {str(e)}")

    def to_dict(self, include_password: bool = False, project_master_key: str = None) -> dict:
        """
        Convert server to dictionary, optionally including decrypted password.
        SECURITY FIX: Password is only included if explicitly requested and key is provided.
        """
        data = {
            "id": self.id,
            "name": self.name,
            "ip_address": self.ip_address,
            "port": self.port,
            "username": self.username,
            "description": self.description,
            "is_active": self.is_active,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "project_id": self.project_id,
        }

        if include_password and project_master_key:
            try:
                data["password"] = self.get_password(project_master_key)
            except Exception as e:
                data["password"] = None
                data["password_error"] = str(e)

        return data


class Billing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    plan = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(32), default="active")  # active, expired, trial
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project = db.relationship("Project", backref="billing")


class ProjectAPIKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), unique=True, nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    description = db.Column(db.String(256), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project = db.relationship("Project", backref="project_api_keys")
