"""
Script to create initial migration that creates all base tables
Run this script to fix the missing base tables issue.

Usage:
    python -m backend.scripts.create_initial_migration

This will:
1. Create an initial migration with all base tables
2. Update the existing migration chain to reference it
"""
import os
import sys
import traceback
import re
import shutil

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

os.chdir(backend_dir)

from flask import Flask
from flask_migrate import Migrate, migrate as create_migration

from backend.config.config import Config
from backend.core.extensions import db

# Import all models to ensure they're registered
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

def create_initial_migration():
    """Create initial migration that creates all base tables"""
    print("Creating initial migration...")
    
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    migrate = Migrate(app, db)
    
    with app.app_context():
        migrations_dir = os.path.join(backend_dir, "migrations")
        versions_dir = os.path.join(migrations_dir, "versions")
        
        if not os.path.exists(migrations_dir):
            print("ERROR: Migrations directory does not exist. Please run setup_migrations first.")
            return False
        
        try:
            # Temporarily move existing migrations to avoid conflicts
            backup_dir = os.path.join(versions_dir, "backup")
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir)
            
            existing_files = []
            for file in os.listdir(versions_dir):
                if file.endswith('.py') and not file.startswith('__') and file != 'backup':
                    existing_files.append(file)
                    src = os.path.join(versions_dir, file)
                    dst = os.path.join(backup_dir, file)
                    print(f"  Backing up {file}...")
                    shutil.move(src, dst)
            
            # Create the initial migration
            print("Generating migration from models...")
            create_migration(message="Initial migration - create all base tables")
            print("✓ Initial migration created")
            
            # Restore existing migrations
            for file in existing_files:
                src = os.path.join(backup_dir, file)
                dst = os.path.join(versions_dir, file)
                shutil.move(src, dst)
                print(f"  Restored {file}...")
            
            # Find the newly created migration file
            migration_files = sorted([f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')])
            
            if not migration_files:
                print("ERROR: No migration file was created")
                return False
            
            # The last file should be the newly created one
            initial_migration_file = os.path.join(versions_dir, migration_files[-1])
            
            # Extract the revision ID from the newly created migration and ensure it's the base
            with open(initial_migration_file, 'r') as f:
                initial_content = f.read()
            
            revision_match = re.search(r"revision\s*=\s*['\"]([^'\"]+)['\"]", initial_content)
            if not revision_match:
                print("WARNING: Could not extract revision ID from initial migration")
                return True
            
            initial_revision = revision_match.group(1)
            print(f"✓ Initial migration revision ID: {initial_revision}")
            
            # Ensure the initial migration has down_revision = None (it's the base)
            if "down_revision = None" not in initial_content and "down_revision=None" not in initial_content:
                print("✓ Ensuring initial migration is the base (down_revision = None)...")
                initial_content = re.sub(
                    r"down_revision\s*=\s*['\"][^'\"]+['\"]",
                    "down_revision = None",
                    initial_content
                )
                # If no down_revision was found, add it
                if "down_revision" not in initial_content:
                    initial_content = re.sub(
                        r"(revision\s*=\s*['\"][^'\"]+['\"])",
                        r"\1\ndown_revision = None",
                        initial_content,
                        count=1
                    )
                
                with open(initial_migration_file, 'w') as f:
                    f.write(initial_content)
                print("  ✓ Initial migration set as base")
            
            # Update all existing migrations to reference this initial migration if they reference missing migrations
            for migration_file in os.listdir(versions_dir):
                if not migration_file.endswith('.py') or migration_file.startswith('__'):
                    continue
                
                file_path = os.path.join(versions_dir, migration_file)
                
                # Skip the initial migration we just created
                if file_path == initial_migration_file:
                    continue
                
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Check if this migration references a missing migration
                # Look for down_revision that might reference non-existent migrations
                down_rev_match = re.search(r"down_revision\s*=\s*['\"]([^'\"]+)['\"]", content)
                if down_rev_match:
                    referenced_rev = down_rev_match.group(1)
                    
                    # Check if this revision exists in any migration file
                    revision_exists = False
                    for other_file in os.listdir(versions_dir):
                        if other_file == migration_file or not other_file.endswith('.py') or other_file.startswith('__'):
                            continue
                        other_path = os.path.join(versions_dir, other_file)
                        with open(other_path, 'r') as f2:
                            other_content = f2.read()
                            if f"revision = '{referenced_rev}'" in other_content:
                                revision_exists = True
                                break
                    
                    # If the referenced revision doesn't exist, update to reference initial migration
                    if not revision_exists:
                        print(f"✓ Updating {migration_file}: {referenced_rev} -> {initial_revision}")
                        content = re.sub(
                            r"down_revision\s*=\s*['\"][^'\"]+['\"]",
                            f"down_revision = '{initial_revision}'",
                            content
                        )
                        
                        with open(file_path, 'w') as f:
                            f.write(content)
                        print(f"  ✓ Updated {migration_file}")
            
            print("\n" + "="*60)
            print("SUCCESS: Initial migration created!")
            print("="*60)
            print("\nNext steps:")
            print("1. Review the migration file:", initial_migration_file)
            print("2. Apply the migration: python -m backend.scripts.apply_migration")
            print("   OR: flask db upgrade")
            print("\n")
            
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to create initial migration: {e}")
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = create_initial_migration()
    sys.exit(0 if success else 1)

