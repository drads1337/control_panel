"""
Key and device-related models
"""

from datetime import datetime

from ..core.extensions import db


class Key(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    user = db.relationship("User", backref="keys")
    key = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    max_devices = db.Column(db.Integer, default=1)
    devices = db.Column(db.Text, default="")
    status = db.Column(db.Integer, default=1)  # 1 - active, 0 - inactive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=True)
    game = db.relationship("Game", backref="keys")
    loader_id = db.Column(db.Integer, db.ForeignKey("loader.id"), nullable=True)
    activated_at = db.Column(db.DateTime, nullable=True)
    duration_hours = db.Column(db.Float, default=24)
    fingerprint = db.Column(db.Text, nullable=True)
    key_metadata = db.Column(db.Text, nullable=True)  # JSON string for additional data
    deviceinfo = db.relationship("DeviceInfo", backref="key", cascade="all, delete-orphan")
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="keys")


class DeviceInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_id = db.Column(db.Integer, db.ForeignKey("key.id", ondelete="CASCADE"))
    device_id = db.Column(db.String(128), nullable=True)  # android_id, ios_id, windows_id, etc.
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
    date = db.Column(db.Date, nullable=False)  # Date for statistics grouping
    total_connections = db.Column(db.Integer, default=0)  # Total number of connections
    unique_devices = db.Column(db.Integer, default=0)  # Number of unique devices
    total_connection_time = db.Column(db.Integer, default=0)  # Total connection time in seconds
    peak_concurrent = db.Column(
        db.Integer, default=0
    )  # Peak number of concurrent connections
    countries = db.Column(db.Text, nullable=True)  # JSON list of countries
    games_played = db.Column(db.Text, nullable=True)  # JSON list of games
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Index for fast lookup by key and date
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
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)  # SHA256 hash
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    key_id = db.Column(db.Integer, db.ForeignKey("key.id", ondelete="CASCADE"), nullable=True)
    game_name = db.Column(db.String(128), nullable=True)
    serial = db.Column(db.String(128), nullable=True)
    is_classic = db.Column(db.Boolean, default=False)  # True for classic tokens
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
    game_ids = db.Column(db.PickleType, nullable=True)
    rbac_role_ids = db.Column(db.PickleType, nullable=True)  # RBAC roles for the user
    token_balance = db.Column(db.BigInteger, default=0)  # Token balance for the user
    work_duration_days = db.Column(db.Integer, default=7)  # Employee work duration in days
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project = db.relationship("Project", backref="referral_codes")

    @property
    def game_ids_list(self):
        """Get game_ids as a proper list"""
        if self.game_ids is None:
            return []

        # If it's already a list, return as is
        if isinstance(self.game_ids, list):
            return self.game_ids

        # If it's a string, try to parse it
        if isinstance(self.game_ids, str):
            try:
                # Remove square brackets and split by comma
                clean_str = self.game_ids.strip("[]")
                if clean_str:
                    return [int(x.strip()) for x in clean_str.split(",")]
                return []
            except (ValueError, AttributeError):
                return []

        # If it's something else, return empty list
        return []

    @game_ids_list.setter
    def game_ids_list(self, value):
        """Set game_ids as a list"""
        if isinstance(value, list):
            self.game_ids = value
        else:
            self.game_ids = []

    @property
    def rbac_role_ids_list(self):
        """Get rbac_role_ids as a proper list"""
        if self.rbac_role_ids is None:
            return []

        # If it's already a list, return as is
        if isinstance(self.rbac_role_ids, list):
            return self.rbac_role_ids

        # If it's a string, try to parse it
        if isinstance(self.rbac_role_ids, str):
            try:
                # Remove square brackets and split by comma
                clean_str = self.rbac_role_ids.strip("[]")
                if clean_str:
                    return [int(x.strip()) for x in clean_str.split(",")]
                return []
            except (ValueError, AttributeError):
                return []

        # If it's something else, return empty list
        return []

    @rbac_role_ids_list.setter
    def rbac_role_ids_list(self, value):
        """Set rbac_role_ids as a list"""
        if isinstance(value, list):
            self.rbac_role_ids = value
        else:
            self.rbac_role_ids = []
