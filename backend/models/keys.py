"""
Key and device-related models
"""

import random
from datetime import datetime

from ..core.extensions import db

def generate_unique_key_id():
    """Generate a unique 9-digit key ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(9)])
        
        existing_key = Key.query.filter_by(unique_id=unique_id).first()
        if not existing_key:
            return unique_id

class Key(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(9), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    user = db.relationship("User", backref="keys")
    key = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    max_devices = db.Column(db.Integer, default=1)
    devices = db.Column(db.Text, default="")
    status = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=True)
    product = db.relationship("Product", backref="keys")  
    agent_id = db.Column(db.Integer, db.ForeignKey("agent.id"), nullable=True)
    activated_at = db.Column(db.DateTime, nullable=True)
    duration_hours = db.Column(db.Float, default=24)
    fingerprint = db.Column(db.Text, nullable=True)
    key_metadata = db.Column(db.Text, nullable=True)
    deviceinfo = db.relationship("DeviceInfo", backref="key", cascade="all, delete-orphan")
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="keys")

    def __init__(self, **kwargs):
        super(Key, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_key_id()

class DeviceInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_id = db.Column(db.Integer, db.ForeignKey("key.id", ondelete="CASCADE"))
    device_id = db.Column(db.String(128), nullable=True)
    device_model = db.Column(db.String(128), nullable=True)
    device_brand = db.Column(db.String(128), nullable=True)
    serial = db.Column(db.String(128), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    connected_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)

class KeyAnalytics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_id = db.Column(db.Integer, db.ForeignKey("key.id", ondelete="CASCADE"))
    date = db.Column(db.Date, nullable=False)
    total_connections = db.Column(db.Integer, default=0)
    unique_devices = db.Column(db.Integer, default=0)
    total_connection_time = db.Column(db.Integer, default=0)
    peak_concurrent = db.Column(
        db.Integer, default=0
    )
    countries = db.Column(db.Text, nullable=True)
    products_played = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.Index("idx_key_date", "key_id", "date"),)

class TokenTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    type = db.Column(db.String(16), nullable=False)
    description = db.Column(db.String(256), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="token_transactions")

class ConnectToken(db.Model):
    """
    Model for storing connect tokens with indexed lookup for secure validation.
    This prevents DoS attacks from token enumeration.
    """
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    key_id = db.Column(db.Integer, db.ForeignKey("key.id", ondelete="CASCADE"), nullable=True)
    product_name = db.Column(db.String(128), nullable=True)
    serial = db.Column(db.String(128), nullable=True)
    is_classic = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    last_used = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref="connect_tokens")
    key = db.relationship("Key", backref="connect_tokens")

    __table_args__ = (db.Index("idx_connect_token_token", "token"),)

class ReferralCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    used = db.Column(db.Boolean, default=False)
    used_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    # SECURITY: Using JSON instead of PickleType to prevent RCE attacks
    # PickleType is unsafe - if attacker gets DB access, they can execute arbitrary code
    # JSON is safe and provides the same functionality for list storage
    product_ids = db.Column(db.JSON, nullable=True)
    rbac_role_ids = db.Column(db.JSON, nullable=True)
    token_balance = db.Column(db.BigInteger, default=0)
    work_duration_days = db.Column(db.Integer, default=7)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project = db.relationship("Project", backref="referral_codes")

    @property
    def product_ids_list(self):
        """Get product_ids as a proper list"""
        if self.product_ids is None:
            return []

        # JSON column already stores as list, but handle legacy data
        if isinstance(self.product_ids, list):
            return self.product_ids

        # Handle legacy string format (backward compatibility)
        if isinstance(self.product_ids, str):
            try:
                import json
                # Try to parse as JSON first
                parsed = json.loads(self.product_ids)
                if isinstance(parsed, list):
                    return parsed
                # Fallback to comma-separated string
                clean_str = self.product_ids.strip("[]")
                if clean_str:
                    return [int(x.strip()) for x in clean_str.split(",")]
                return []
            except (ValueError, AttributeError, json.JSONDecodeError):
                return []

        return []

    @product_ids_list.setter
    def product_ids_list(self, value):
        """Set product_ids as a list"""
        if isinstance(value, list):
            self.product_ids = value
        else:
            self.product_ids = []

    @property
    def rbac_role_ids_list(self):
        """Get rbac_role_ids as a proper list"""
        if self.rbac_role_ids is None:
            return []

        # JSON column already stores as list, but handle legacy data
        if isinstance(self.rbac_role_ids, list):
            return self.rbac_role_ids

        # Handle legacy string format (backward compatibility)
        if isinstance(self.rbac_role_ids, str):
            try:
                import json
                # Try to parse as JSON first
                parsed = json.loads(self.rbac_role_ids)
                if isinstance(parsed, list):
                    return parsed
                # Fallback to comma-separated string
                clean_str = self.rbac_role_ids.strip("[]")
                if clean_str:
                    return [int(x.strip()) for x in clean_str.split(",")]
                return []
            except (ValueError, AttributeError, json.JSONDecodeError):
                return []

        return []

    @rbac_role_ids_list.setter
    def rbac_role_ids_list(self, value):
        """Set rbac_role_ids as a list"""
        if isinstance(value, list):
            self.rbac_role_ids = value
        else:
            self.rbac_role_ids = []
