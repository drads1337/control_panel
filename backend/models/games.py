"""
Product-related models (formerly Game-related)
Universal terminology for B2B/SaaS applications
"""

import json
import random
from datetime import datetime

from ..core.extensions import db

def generate_unique_product_id():
    """Generate a unique 7-digit product ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(7)])

        existing_product = Product.query.filter_by(unique_id=unique_id).first()
        if not existing_product:
            return unique_id

# Backward compatibility alias
def generate_unique_game_id():
    """Generate a unique 7-digit product ID (deprecated: use generate_unique_product_id)"""
    return generate_unique_product_id()

class Product(db.Model):
    """Product model - universal term for applications, software, or games"""
    
    __tablename__ = "game"  # Keep table name for backward compatibility
    
    id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(7), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    status = db.Column(db.String(32), default="active")
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="games")

    __table_args__ = (db.UniqueConstraint("name", "project_id", name="uq_game_name_project"),)

    logo = db.Column(db.String(256), nullable=True)
    banner = db.Column(db.String(256), nullable=True)
    backgrounds = db.Column(db.Text, nullable=True)
    loader_file = db.Column(db.String(256), nullable=True)
    changelog = db.Column(db.Text, nullable=True)
    notifications = db.Column(db.Text, nullable=True)
    version = db.Column(db.String(32), default="1.0.0")
    downloads = db.Column(db.Integer, default=0)
    active_users = db.Column(db.Integer, default=0)
    is_multi_app = db.Column(
        db.Boolean, default=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    login_type = db.Column(
        db.String(32), default="license_generation"
    )
    invite_code_required = db.Column(
        db.Boolean, default=False
    )

    custom_key_prefix = db.Column(db.String(64), nullable=True)
    key_prefix_format = db.Column(
        db.String(128), default="{name}-{duration}-{custom}"
    )

    def __init__(self, **kwargs):
        super(Product, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_product_id()

    @property
    def backgrounds_list(self):
        """Get backgrounds as a list"""
        if self.backgrounds:
            try:
                return json.loads(self.backgrounds)
            except:
                return []
        return []

    @backgrounds_list.setter
    def backgrounds_list(self, value):
        """Set backgrounds as a JSON string"""
        if isinstance(value, list):
            self.backgrounds = json.dumps(value)
        else:
            self.backgrounds = value

    @property
    def logo_url(self):
        return self.logo

    @logo_url.setter
    def logo_url(self, value):
        self.logo = value

    @property
    def banner_url(self):
        return self.banner

    @banner_url.setter
    def banner_url(self, value):
        self.banner = value

    @property
    def file(self):
        return self.loader_file

    @file.setter
    def file(self, value):
        self.loader_file = value

# Create Game alias immediately after Product definition for SQLAlchemy registry
# This ensures SQLAlchemy can resolve "Game" in string-based relationships
Game = Product

class ProductChatSettings(db.Model):
    """Per-product chat settings: platforms and limits (override project-level)"""
    
    __tablename__ = "gamechatsettings"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(
        db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)

    telegram_enabled = db.Column(db.Boolean, default=True)
    discord_enabled = db.Column(db.Boolean, default=True)

    message_limit_per_minute = db.Column(db.Integer, nullable=True)
    daily_message_limit = db.Column(db.Integer, nullable=True)
    message_max_length = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    game = db.relationship(
        "Product", backref=db.backref("chat_settings", uselist=False, cascade="all, delete-orphan")
    )
    project = db.relationship("Project", backref="game_chat_settings")

    @property
    def product_id(self):
        """Alias for game_id for backward compatibility"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

    def __repr__(self):
        return f"<ProductChatSettings game_id={self.game_id}>"

class ProductStatus(db.Model):
    """Product status model"""
    
    __tablename__ = "gamestatus"  # Keep table name for backward compatibility
    
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="safe")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_statuses")
    
    game = db.relationship("Product", backref="statuses")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class RemoteConfig(db.Model):
    """Model for storing remote configuration and feature flags (formerly GameConfiguration)"""
    
    __tablename__ = "gameconfiguration"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(
        db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    game = db.relationship("Product", backref="remote_config")

    auth_methods = db.Column(
        db.Text, nullable=False, default="[]"
    )
    license_key_enabled = db.Column(db.Boolean, default=True)
    invite_code_enabled = db.Column(db.Boolean, default=True)

    max_login_attempts = db.Column(db.Integer, default=5)
    lockout_duration_minutes = db.Column(db.Integer, default=15)
    require_2fa = db.Column(db.Boolean, default=False)
    session_timeout_minutes = db.Column(db.Integer, default=1440)

    key_expiry_hours = db.Column(db.Integer, default=24)
    max_devices_per_key = db.Column(db.Integer, default=1)
    allow_key_renewal = db.Column(db.Boolean, default=True)
    key_renewal_cost_tokens = db.Column(db.Integer, default=10)

    invite_code_expiry_days = db.Column(db.Integer, default=7)
    max_invites_per_code = db.Column(db.Integer, default=1)
    auto_assign_role = db.Column(db.String(32), default="user")

    loader_config = db.Column(db.Text, nullable=True)
    security_level = db.Column(db.String(32), default="standard")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_configurations")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class ProductInviteCode(db.Model):
    """Model for storing product-specific invite codes"""
    
    __tablename__ = "gameinvitecode"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    game = db.relationship("Product", backref="invite_codes")

    max_uses = db.Column(db.Integer, default=1)
    current_uses = db.Column(db.Integer, default=0)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_by_user = db.relationship("User", foreign_keys=[created_by])
    assigned_role = db.Column(db.String(32), default="user")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_invite_codes")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class ProductSecurityLog(db.Model):
    """Model for logging security events for products"""
    
    __tablename__ = "gamesecuritylog"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    game = db.relationship("Product", backref="security_logs")

    event_type = db.Column(
        db.String(64), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    user = db.relationship("User", foreign_keys=[user_id])

    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    country = db.Column(db.String(64), nullable=True)
    city = db.Column(db.String(64), nullable=True)

    details = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(32), default="info")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_security_logs")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class ProductKeyPrice(db.Model):
    """Model for product key pricing"""
    
    __tablename__ = "gamekeyprice"  # Keep table name for backward compatibility
    
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    period = db.Column(db.String(16), nullable=False)
    price = db.Column(db.Float, nullable=False)
    meta_data = db.Column(db.Text, nullable=True)
    __table_args__ = (db.UniqueConstraint("game_id", "period", name="uq_game_period"),)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_key_prices")
    
    game = db.relationship("Product", backref="key_prices")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class ProductFileConfig(db.Model):
    """Model for product file configurations (modules/payloads)"""
    
    __tablename__ = "gamefileconfig"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    config_id = db.Column(db.String(8), unique=True, nullable=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    file_type = db.Column(db.String(64), nullable=False)
    content_hash = db.Column(db.String(64), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.String(32), default="1.0.0")
    is_public = db.Column(db.Boolean, default=True)
    download_count = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=0.0)
    rating_count = db.Column(db.Integer, default=0)

    uploader = db.relationship("User", backref="uploaded_game_configs")
    game = db.relationship("Product", backref="file_configs")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

    def __repr__(self):
        return f"<ProductFileConfig {self.name}>"

class ProductExtraFile(db.Model):
    """Model for additional product files"""
    
    __tablename__ = "gameextrafile"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    original_filename = db.Column(
        db.String(256), nullable=False
    )
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    file_type = db.Column(db.String(64), nullable=False)
    content_hash = db.Column(db.String(64), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(32), default="active")
    download_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    uploader = db.relationship("User", backref="uploaded_game_extra_files")
    game = db.relationship("Product", backref="extra_files")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

    def __repr__(self):
        return f"<ProductExtraFile {self.name}>"

class ProductFileDownload(db.Model):
    """Model for tracking product file downloads"""
    
    __tablename__ = "gamefiledownload"  # Keep table name for backward compatibility

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(32), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    downloaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)

    user = db.relationship("User", backref="game_file_downloads")

    def __repr__(self):
        return f"<ProductFileDownload {self.file_type}:{self.file_id}>"

class ChangelogEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    version = db.Column(db.String(32), nullable=False)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    changes = db.Column(db.Text, nullable=False)
    release_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    game = db.relationship("Product", backref="changelog_entries")
    creator = db.relationship("User", backref="created_changelog_entries")
    project = db.relationship("Project", backref="changelog_entries")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

    @property
    def changes_list(self):
        """Get changes as a list"""
        try:
            return json.loads(self.changes) if self.changes else []
        except:
            return []

    @changes_list.setter
    def changes_list(self, value):
        """Set changes as a list"""
        self.changes = json.dumps(value) if value else "[]"

class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(128), nullable=True)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(32), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="announcements")
    
    game = db.relationship("Product", backref="announcements")

    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id

    @property
    def product(self):
        """Alias for game relationship"""
        return self.game

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="messages")

class FileDownloadLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), nullable=False)
    filename = db.Column(db.String(256), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(64), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="file_download_logs")

class FileMeta(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), unique=True, nullable=False)
    status = db.Column(db.String(16), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="file_metas")

class FeatureConfigSchema(db.Model):
    """
    Model for storing JSON schemas for feature configuration (Feature Management).
    Allows clients to define custom configuration structures for their products.
    
    This replaces hardcoded templates (fps, moba, mmo) with flexible, user-defined schemas.
    """
    
    __tablename__ = "feature_config_schema"
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # JSON Schema definition (validates the structure of config values)
    json_schema = db.Column(db.Text, nullable=False)
    
    # Default configuration template (example/default values matching the schema)
    default_config = db.Column(db.Text, nullable=True)
    
    # Product/Game association (optional - can be global or product-specific)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=True)
    product = db.relationship("Product", backref="feature_schemas")
    
    @property
    def product_id(self):
        """Alias for game_id"""
        return self.game_id
    
    @property
    def game(self):
        """Backward compatibility alias for product relationship"""
        return self.product
    
    # Project association
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    project = db.relationship("Project", backref="feature_config_schemas")
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.String(32), default="1.0.0")
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_by_user = db.relationship("User", foreign_keys=[created_by])
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint("name", "project_id", name="uq_feature_schema_name_project"),
    )
    
    @property
    def schema_dict(self):
        """Get JSON schema as a dictionary"""
        try:
            return json.loads(self.json_schema) if self.json_schema else {}
        except:
            return {}
    
    @schema_dict.setter
    def schema_dict(self, value):
        """Set JSON schema from a dictionary"""
        self.json_schema = json.dumps(value) if value else "{}"
    
    @property
    def default_config_dict(self):
        """Get default config as a dictionary"""
        try:
            return json.loads(self.default_config) if self.default_config else {}
        except:
            return {}
    
    @default_config_dict.setter
    def default_config_dict(self, value):
        """Set default config from a dictionary"""
        self.default_config = json.dumps(value) if value else "{}"
    
    def __repr__(self):
        return f"<FeatureConfigSchema {self.name} (project_id={self.project_id})>"

GameChatSettings = ProductChatSettings
GameStatus = ProductStatus
GameConfiguration = RemoteConfig
GameInviteCode = ProductInviteCode
GameSecurityLog = ProductSecurityLog
GameKeyPrice = ProductKeyPrice
GameFileConfig = ProductFileConfig
GameExtraFile = ProductExtraFile
GameFileDownload = ProductFileDownload