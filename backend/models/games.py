"""
Game-related models
"""

import json
import random
from datetime import datetime

from ..core.extensions import db

def generate_unique_game_id():
    """Generate a unique 7-digit game ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(7)])

        existing_game = Game.query.filter_by(unique_id=unique_id).first()
        if not existing_game:
            return unique_id

class Game(db.Model):
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
        super(Game, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_game_id()

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

class GameChatSettings(db.Model):
    """Per-game chat settings: platforms and limits (override project-level)"""

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
        "Game", backref=db.backref("chat_settings", uselist=False, cascade="all, delete-orphan")
    )
    project = db.relationship("Project", backref="game_chat_settings")

    def __repr__(self):
        return f"<GameChatSettings game_id={self.game_id}>"

class GameStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="safe")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_statuses")

class GameConfiguration(db.Model):
    """Model for storing game configuration and authentication settings"""

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(
        db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    game = db.relationship("Game", backref="configuration")

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

class GameInviteCode(db.Model):
    """Model for storing game-specific invite codes"""

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    game = db.relationship("Game", backref="invite_codes")

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

class GameSecurityLog(db.Model):
    """Model for logging security events for games"""

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    game = db.relationship("Game", backref="security_logs")

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

class GameKeyPrice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("game.id"), nullable=False)
    period = db.Column(db.String(16), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    meta_data = db.Column(db.Text, nullable=True)
    __table_args__ = (db.UniqueConstraint("game_id", "period", name="uq_game_period"),)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="game_key_prices")

class GameFileConfig(db.Model):
    """Модель для конфигураций игр"""

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

    def __repr__(self):
        return f"<GameFileConfig {self.name}>"

class GameExtraFile(db.Model):
    """Модель для дополнительных файлов игр"""

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

    def __repr__(self):
        return f"<GameExtraFile {self.name}>"

class GameFileDownload(db.Model):
    """Модель для отслеживания загрузок файлов игр"""

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(32), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    downloaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)

    user = db.relationship("User", backref="game_file_downloads")

    def __repr__(self):
        return f"<GameFileDownload {self.file_type}:{self.file_id}>"

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

    game = db.relationship("Game", backref="changelog_entries")
    creator = db.relationship("User", backref="created_changelog_entries")
    project = db.relationship("Project", backref="changelog_entries")

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
