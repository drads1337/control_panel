"""
Loader-related models
"""

import json
from datetime import datetime

from ..core.extensions import db

class Loader(db.Model):
    """Model for managing loaders"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), default="active")
    logo = db.Column(db.String(256), nullable=True)
    banner = db.Column(db.String(256), nullable=True)
    background = db.Column(db.String(256), nullable=True)
    file = db.Column(db.String(256), nullable=True)
    changelog = db.Column(db.Text, nullable=True)
    notifications = db.Column(db.Text, nullable=True)
    version = db.Column(db.String(32), default="1.0.0")
    downloads = db.Column(db.Integer, default=0)
    active_users = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

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

    creator = db.relationship("User", backref="created_loaders")
    project = db.relationship("Project", backref="loaders")

    def __repr__(self):
        return f"<Loader {self.name}>"

class LoaderGameAssignment(db.Model):
    """Model for assigning games to loaders"""

    id = db.Column(db.Integer, primary_key=True)
    loader_id = db.Column(
        db.Integer, db.ForeignKey("loader.id", ondelete="CASCADE"), nullable=False
    )
    game_id = db.Column(db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    loader = db.relationship("Loader", backref="game_assignments")
    game = db.relationship("Game", backref="loader_assignments")
    assigner = db.relationship("User", backref="assigned_games")
    project = db.relationship("Project", backref="loader_game_assignments")

    __table_args__ = (db.UniqueConstraint("loader_id", "game_id", name="uq_loader_game"),)

    def __repr__(self):
        return f"<LoaderGameAssignment {self.loader_id}:{self.game_id}>"

class LoaderChangelog(db.Model):
    """Model for loader changelog entries"""

    id = db.Column(db.Integer, primary_key=True)
    loader_id = db.Column(
        db.Integer, db.ForeignKey("loader.id", ondelete="CASCADE"), nullable=False
    )
    version = db.Column(db.String(32), nullable=False)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    changes = db.Column(db.Text, nullable=False)
    change_type = db.Column(
        db.String(32), default="release"
    )
    custom_type_name = db.Column(db.String(64), nullable=True)
    release_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    loader = db.relationship("Loader", backref="changelog_entries")
    creator = db.relationship("User", backref="created_loader_changelog_entries")
    project = db.relationship("Project", backref="loader_changelog_entries")

    @property
    def changes_list(self):
        """Get changes as a list"""
        try:
            return json.loads(self.changes) if self.changes else []
        except (json.JSONDecodeError, TypeError):
            return []

    @changes_list.setter
    def changes_list(self, value):
        """Set changes from a list"""
        self.changes = json.dumps(value) if value else "[]"

    def __repr__(self):
        return f"<LoaderChangelog {self.loader_id}:{self.version}>"

class LoaderNotification(db.Model):
    """Model for loader notifications"""

    id = db.Column(db.Integer, primary_key=True)
    loader_id = db.Column(
        db.Integer, db.ForeignKey("loader.id", ondelete="CASCADE"), nullable=False
    )
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(32), default="info")
    is_scheduled = db.Column(db.Boolean, default=False)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    sent_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    loader = db.relationship("Loader", backref="loader_notifications")
    creator = db.relationship("User", backref="created_loader_notifications")
    project = db.relationship("Project", backref="loader_notifications")

    def __repr__(self):
        return f"<LoaderNotification {self.loader_id}:{self.type}>"

class LoaderDownloadLog(db.Model):
    """Model for tracking loader downloads"""

    id = db.Column(db.Integer, primary_key=True)
    loader_id = db.Column(
        db.Integer, db.ForeignKey("loader.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    download_date = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    loader = db.relationship("Loader", backref="download_logs")
    user = db.relationship("User", backref="loader_downloads")
    project = db.relationship("Project", backref="loader_download_logs")

    def __repr__(self):
        return f"<LoaderDownloadLog {self.loader_id}:{self.download_date}>"

class LoaderConfiguration(db.Model):
    """Model for storing loader-specific configuration"""

    id = db.Column(db.Integer, primary_key=True)
    loader_id = db.Column(
        db.Integer, db.ForeignKey("loader.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    loader = db.relationship("Loader", backref="configuration")

    version = db.Column(db.String(32), default="1.0.0")
    update_url = db.Column(db.String(256), nullable=True)
    auto_update = db.Column(db.Boolean, default=True)

    checksum_verification = db.Column(db.Boolean, default=True)
    signature_verification = db.Column(db.Boolean, default=True)
    anti_debug = db.Column(db.Boolean, default=True)
    anti_vm = db.Column(db.Boolean, default=True)

    memory_protection = db.Column(db.Boolean, default=True)
    process_isolation = db.Column(db.Boolean, default=True)

    config_data = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="loader_configurations")
