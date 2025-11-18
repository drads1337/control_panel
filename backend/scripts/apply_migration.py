
"""
Script to apply database migrations
"""
import os
import sys
import traceback

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

os.chdir(backend_dir)

from backend.core.app import create_app
from backend.utils.structured_logging import get_logger
from flask_migrate import upgrade

logger = get_logger(__name__)

def apply_migrations():
    """Apply pending migrations"""
    app = create_app()

    with app.app_context():
        logger.info("Applying database migrations", component="migrations")
        try:
            upgrade(revision="head")
            logger.info("Migrations applied successfully", component="migrations")
            return True
        except Exception as e:
            logger.error(
                "Error applying migrations",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

if __name__ == "__main__":
    success = apply_migrations()
    sys.exit(0 if success else 1)
