
"""
Script to initialize and create database migrations

SECURITY: This script requires all environment variables to be set explicitly.
No default values are provided to prevent accidental use of insecure defaults in production.
"""
import os
import sys
import traceback

# SECURITY: Do not set default values for sensitive configuration.
# The application must fail if environment variables are not set.
# This prevents accidental use of insecure defaults in production.
if not os.environ.get("DATABASE_URL"):
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: DATABASE_URL environment variable is not set!\n"
        "This script requires DATABASE_URL to be set explicitly.\n"
        "Please set DATABASE_URL with your PostgreSQL connection string.\n"
        "Example: export DATABASE_URL='postgresql://username:password@localhost/database'"
    )

if not os.environ.get("SECRET_KEY"):
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set!\n"
        "This script requires SECRET_KEY to be set explicitly.\n"
        "Please set SECRET_KEY with a secure random string.\n"
        "Example: export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
    )

if not os.environ.get("JWT_SECRET_KEY"):
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: JWT_SECRET_KEY environment variable is not set!\n"
        "This script requires JWT_SECRET_KEY to be set explicitly.\n"
        "Please set JWT_SECRET_KEY with a secure random string.\n"
        "Example: export JWT_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
    )

if not os.environ.get("PANEL_MASTER_KEY"):
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: PANEL_MASTER_KEY environment variable is not set!\n"
        "This script requires PANEL_MASTER_KEY to be set explicitly.\n"
        "Please set PANEL_MASTER_KEY with a secure 32-byte hex key.\n"
        "Example: export PANEL_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')"
    )

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
