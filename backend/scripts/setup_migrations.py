#!/usr/bin/env python3
"""
Script to initialize and create database migrations
"""
import os
import sys
import traceback

# Set environment variables before importing app
os.environ["DATABASE_URL"] = "postgresql://panel123:password123@localhost:5432/panel123"

# Set required environment variables (if not set)
import secrets

if not os.environ.get("SECRET_KEY"):
    os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)
if not os.environ.get("MASTER_KEY"):
    os.environ["MASTER_KEY"] = secrets.token_urlsafe(32)

# Add parent directory to path (one level up from backend to include backend as package)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from flask import Flask
from flask_migrate import Migrate, init
from flask_migrate import migrate as create_migration

# Import all models so Flask-Migrate can detect them
# This is critical for autogenerate to work
# Explicitly import all model modules to ensure they're registered with SQLAlchemy metadata
# Note: We import modules directly rather than using lazy imports to ensure all models
# are loaded and registered with db.metadata for migrations
from backend.models import (  # noqa: F401
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

# Import after setting env vars
from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)


def setup_migrations():
    """Initialize and create migrations"""
    logger.info("Setting up database migrations", component="migrations")

    # Create minimal app for migrations (bypass Redis check)
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    # Initialize Migrate
    migrate = Migrate(app, db)

    with app.app_context():
        # Check if migrations folder exists
        migrations_dir = os.path.join(backend_dir, "migrations")
        os.chdir(backend_dir)  # Change to backend directory for migrations

        if not os.path.exists(migrations_dir):
            logger.info("Initializing migrations directory", component="migrations")
            init()
            logger.info("Migrations directory initialized", component="migrations")
        else:
            logger.info("Migrations directory already exists", component="migrations")

        # Create initial migration
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
