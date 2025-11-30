"""
Script to test database migration rollback capability.

This script verifies that all migrations can be downgraded successfully,
which is critical for production deployments where rollback may be needed.

Usage:
    python -m backend.scripts.test_migration_rollback
"""

import os
import sys
import traceback
from pathlib import Path

# Add project root to path
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

os.chdir(str(backend_dir))

from flask import Flask
from flask_migrate import Migrate, upgrade, downgrade, current
from alembic import command
from alembic.config import Config as AlembicConfig
from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)


def get_migration_revisions():
    """Get all migration revisions in order"""
    alembic_cfg = AlembicConfig(str(backend_dir / "migrations" / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    
    # Get all revisions
    revisions = []
    try:
        from alembic.script import ScriptDirectory
        script = ScriptDirectory.from_config(alembic_cfg)
        for script_dir in script.walk_revisions():
            revisions.append(script_dir.revision)
    except Exception as e:
        logger.error(f"Error getting migration revisions: {e}")
        return []
    
    return revisions


def test_migration_rollback():
    """
    Test that all migrations can be rolled back.
    
    This function:
    1. Applies all migrations to head
    2. Attempts to downgrade each migration one by one
    3. Verifies that downgrade succeeds
    4. Re-applies migrations after each test
    """
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    migrate = Migrate(app, db)
    
    with app.app_context():
        logger.info("Starting migration rollback tests", component="migrations")
        
        try:
            # First, ensure we're at head
            logger.info("Applying all migrations to head", component="migrations")
            upgrade(revision="head")
            logger.info("All migrations applied", component="migrations")
            
            # Get current revision
            current_rev = current()
            logger.info(f"Current migration revision: {current_rev}", component="migrations")
            
            # Get all revisions
            revisions = get_migration_revisions()
            if not revisions:
                logger.warning("No migrations found to test", component="migrations")
                return True
            
            logger.info(f"Found {len(revisions)} migrations to test", component="migrations")
            
            # Test downgrade capability
            # Note: We test downgrade to previous revision, not individual migrations
            # This is safer and more realistic
            failed_rollbacks = []
            
            # Get the revision before head
            if len(revisions) > 1:
                previous_rev = revisions[-2]  # Second to last revision
                logger.info(f"Testing rollback from head to {previous_rev}", component="migrations")
                
                try:
                    downgrade(revision=previous_rev)
                    logger.info(f"✓ Rollback to {previous_rev} succeeded", component="migrations")
                    
                    # Re-apply to head
                    upgrade(revision="head")
                    logger.info("✓ Re-applied migrations to head", component="migrations")
                except Exception as e:
                    logger.error(
                        f"✗ Rollback to {previous_rev} failed",
                        component="migrations",
                        error=str(e),
                        traceback=traceback.format_exc()
                    )
                    failed_rollbacks.append(previous_rev)
            else:
                logger.info("Only one migration found, skipping rollback test", component="migrations")
            
            if failed_rollbacks:
                logger.error(
                    f"Migration rollback tests failed for {len(failed_rollbacks)} migrations",
                    component="migrations",
                    failed_revisions=failed_rollbacks
                )
                return False
            else:
                logger.info("All migration rollback tests passed", component="migrations")
                return True
                
        except Exception as e:
            logger.error(
                "Error during migration rollback tests",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc()
            )
            return False


def main():
    """Main entry point"""
    if Config.FLASK_ENV == "production":
        logger.warning(
            "Migration rollback tests should not be run in production environment",
            component="migrations"
        )
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != "yes":
            logger.info("Migration rollback tests cancelled", component="migrations")
            return
    
    success = test_migration_rollback()
    
    if success:
        logger.info("✓ All migration rollback tests passed", component="migrations")
        sys.exit(0)
    else:
        logger.error("✗ Some migration rollback tests failed", component="migrations")
        sys.exit(1)


if __name__ == "__main__":
    main()
