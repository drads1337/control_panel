
"""
Script to initialize and create database migrations
"""
import os
import sys
import traceback

os.environ["DATABASE_URL"] = "postgresql://panel123:password123@localhost:5432/panel123"

import secrets

if not os.environ.get("SECRET_KEY"):
    os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)
if not os.environ.get("MASTER_KEY"):
    os.environ["MASTER_KEY"] = secrets.token_urlsafe(32)

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from flask import Flask
from flask_migrate import Migrate, init
from flask_migrate import migrate as create_migration

from backend.models import (
    APIKey,
    Announcement,
    AttributeRule,
    Billing,
    BlockedFingerprint,
    BlockedHWID,
    BlockedIP,
    ChangelogEntry,
    ChatGroup,
    ChatGroupGame,
    ChatMessage,
    ConnectToken,
    DeveloperGamePermission,
    DeviceInfo,
    DiscordWebhook,
    FileDownloadLog,
    FileMeta,
    Game,
    GameChatSettings,
    GameConfiguration,
    GameExtraFile,
    GameFileConfig,
    GameFileDownload,
    GameInviteCode,
    GameKeyPrice,
    GameSecurityLog,
    GameStatus,
    Key,
    KeyAnalytics,
    Loader,
    LoaderChangelog,
    LoaderConfiguration,
    LoaderDownloadLog,
    LoaderGameAssignment,
    LoaderNotification,
    LoginAttempt,
    Message,
    Notification,
    Permission,
    Project,
    ProjectAdmin,
    ProjectAPIKey,
    ProjectEncryptionKeys,
    ProjectInviteCode,
    ProjectSettings,
    ProjectUserRole,
    ReferralCode,
    RemoteCategory,
    RemoteFeature,
    RemoteFeatureLog,
    ResourceAttribute,
    Role,
    RolePermission,
    SecurityAnalytics,
    SecurityEvent,
    SecurityRule,
    Server,
    SystemBackup,
    SystemSettings,
    TelegramBot,
    TokenTransaction,
    TwoFactorAuth,
    TwoFactorBackupCode,
    TwoFactorSession,
    User,
    UserActionLog,
    UserActivity,
    UserAttribute,
    UserGamePermission,
    UserRole,
    Webhook,
    WebhookLog,
)

from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)

def setup_migrations():
    """Initialize and create migrations"""
    logger.info("Setting up database migrations", component="migrations")

    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    migrate = Migrate(app, db)

    with app.app_context():

        migrations_dir = os.path.join(backend_dir, "migrations")
        os.chdir(backend_dir)

        if not os.path.exists(migrations_dir):
            logger.info("Initializing migrations directory", component="migrations")
            init()
            logger.info("Migrations directory initialized", component="migrations")
        else:
            logger.info("Migrations directory already exists", component="migrations")

        logger.info("Creating initial migration from models", component="migrations")
        try:
            create_migration(message="Initial migration")
            logger.info("Initial migration created", component="migrations")
            return True
        except Exception as e:
            logger.error(
                "Error creating migration",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

if __name__ == "__main__":
    if setup_migrations():
        logger.info("Migration setup complete", component="migrations")
        sys.exit(0)
    else:
        logger.error("Migration setup failed", component="migrations")
        sys.exit(1)
