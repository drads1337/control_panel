
"""
Script to drop all tables from PostgreSQL database and reset migrations
Uses SQLAlchemy metadata.drop_all() for safe DDL generation
"""
import os
import sys

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

from backend.models import (
    APIKey,
    Announcement,
    AttributeRule,
    Billing,
    BlockedFingerprint,
    BlockedHWID,
    BlockedIP,
    ChatGroup,
    ChatGroupGame,
    ChatMessage,
    ChangelogEntry,
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

logger = get_logger(__name__)

DATABASE_URL = "postgresql://panel123:password123@localhost:5432/panel123"

def drop_all_tables():
    """
    Drop all tables from the database using SQLAlchemy metadata

    SECURITY: Uses SQLAlchemy's metadata.drop_all() instead of f-string SQL generation.
    This eliminates any theoretical risk of SQL injection by using SQLAlchemy's
    built-in DDL generation, which properly handles identifiers and escaping.
    """
    engine = create_engine(DATABASE_URL)

    try:

        db.metadata.bind = engine

        with engine.begin() as conn:

            inspector = inspect(engine)
            tables = inspector.get_table_names()

            if not tables:
                logger.info("No tables found in database", component="database_reset")
                return True

            logger.info(
                f"Found {len(tables)} tables to drop",
                component="database_reset",
                table_count=len(tables)
            )

            db.metadata.drop_all(bind=engine, checkfirst=True)

            logger.info("All tables dropped successfully", component="database_reset")
            return True

    except SQLAlchemyError as e:
        logger.error("Database connection error", component="database_reset", error=str(e))
        return False
    finally:
        engine.dispose()

def drop_alembic_version_table():
    """Drop alembic_version table if it exists"""
    engine = create_engine(DATABASE_URL)

    try:
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
            logger.info("Dropped alembic_version table", component="database_reset")
    except Exception as e:
        logger.warning("Could not drop alembic_version", component="database_reset", error=str(e))
    finally:
        engine.dispose()

if __name__ == "__main__":
    db_name = DATABASE_URL.split("@")[1] if "@" in DATABASE_URL else DATABASE_URL
    logger.info("Starting database reset", component="database_reset", database=db_name)

    drop_alembic_version_table()

    if drop_all_tables():
        logger.info("Database reset complete", component="database_reset")
        sys.exit(0)
    else:
        logger.error("Database reset failed", component="database_reset")
        sys.exit(1)
