"""
Script to apply the price float migration directly via SQL
This is a workaround if the normal migration process gets stuck
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
from sqlalchemy import text
from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)

def apply_price_float_migration():
    """Apply the price float migration directly via SQL"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        try:
            logger.info("Applying price float migration via SQL", component="migrations")
            
            # Check current column type
            result = db.session.execute(text("""
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = 'game_key_price' 
                AND column_name = 'price'
            """))
            
            current_type = result.scalar()
            logger.info(f"Current price column type: {current_type}", component="migrations")
            
            if current_type == 'double precision' or current_type == 'real':
                logger.info("Price column is already Float type, skipping migration", component="migrations")
                return True
            
            # Apply the migration
            logger.info("Changing price column from Integer to Float", component="migrations")
            db.session.execute(text("""
                ALTER TABLE game_key_price 
                ALTER COLUMN price TYPE DOUBLE PRECISION USING price::double precision
            """))
            
            db.session.commit()
            logger.info("Price float migration applied successfully", component="migrations")
            
            # Update alembic version table
            try:
                db.session.execute(text("""
                    INSERT INTO alembic_version (version_num)
                    VALUES ('change_price_to_float_001')
                    ON CONFLICT (version_num) DO NOTHING
                """))
                db.session.commit()
                logger.info("Alembic version updated", component="migrations")
            except Exception as e:
                logger.warning(f"Could not update alembic version (may already exist): {e}", component="migrations")
                db.session.rollback()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(
                "Error applying price float migration",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

if __name__ == "__main__":
    success = apply_price_float_migration()
    sys.exit(0 if success else 1)

