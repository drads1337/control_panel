"""
Script to initialize Flask-Migrate and create initial migration
"""
import os
import sys
import traceback

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

os.chdir(backend_dir)

from flask import Flask
from flask_migrate import Migrate, init, revision
from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

# Import all models to ensure they're registered
from backend.models import *  # noqa: F401, F403

logger = get_logger(__name__)

def init_migrations():
    """Initialize Flask-Migrate repository"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    migrate = Migrate(app, db)

    with app.app_context():
        migrations_dir = os.path.join(backend_dir, "migrations")
        
        # Check if migrations directory already exists
        if os.path.exists(migrations_dir):
            logger.info("Migrations directory already exists", component="migrations")
            return True
        
        logger.info("Initializing Flask-Migrate repository", component="migrations")
        try:
            init()
            logger.info("Migrations repository initialized successfully", component="migrations")
            return True
        except Exception as e:
            logger.error(
                "Error initializing migrations",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

def create_initial_migration():
    """Create initial migration from all models"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    migrate = Migrate(app, db)

    with app.app_context():
        logger.info("Creating initial migration", component="migrations")
        try:
            # Test database connection first
            try:
                with db.engine.connect() as conn:
                    logger.info("Database connection successful", component="migrations")
            except Exception as conn_err:
                logger.warning(
                    "Database connection failed, but continuing with migration creation",
                    component="migrations",
                    error=str(conn_err)
                )
                # For autogenerate, we might need connection, but let's try anyway
            
            # Create migration with autogenerate
            revision(message="Initial migration - create all tables", autogenerate=True)
            logger.info("Initial migration created successfully", component="migrations")
            return True
        except Exception as e:
            logger.error(
                "Error creating initial migration",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

if __name__ == "__main__":
    print("Step 1: Initializing Flask-Migrate...")
    if not init_migrations():
        print("❌ Failed to initialize migrations")
        sys.exit(1)
    
    print("Step 2: Creating initial migration...")
    if not create_initial_migration():
        print("❌ Failed to create initial migration")
        sys.exit(1)
    
    print("✅ Migrations initialized and initial migration created successfully!")
    print("Next step: Run 'python backend/scripts/apply_migration.py' to apply migrations")

