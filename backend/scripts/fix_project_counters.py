#!/usr/bin/env python3
"""
Script to add missing project counter columns if they don't exist.
This is a workaround to fix the database schema mismatch.
"""
import os
import sys

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

# Change to backend directory
os.chdir(backend_dir)

from backend.core.app import create_app
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)


def fix_project_counters():
    """Add missing project counter columns if they don't exist"""
    app = create_app()
    
    with app.app_context():
        logger.info("Checking for missing project counter columns", component="database_fix")
        
        try:
            # Check if columns exist by querying information_schema
            with db.engine.connect() as conn:
                # Check each column
                columns_to_add = [
                    ('total_users', 'INTEGER', '0'),
                    ('total_keys', 'INTEGER', '0'),
                    ('total_games', 'INTEGER', '0'),
                    ('total_servers', 'INTEGER', '0'),
                    ('active_users', 'INTEGER', '0'),
                    ('active_keys', 'INTEGER', '0'),
                ]
                
                for column_name, column_type, default_value in columns_to_add:
                    # Check if column exists
                    from sqlalchemy import text
                    check_query = text("""
                        SELECT EXISTS (
                            SELECT 1 
                            FROM information_schema.columns 
                            WHERE table_name = 'project' 
                            AND column_name = :col_name
                        );
                    """)
                    result = conn.execute(check_query, {'col_name': column_name})
                    exists = result.scalar()
                    
                    if not exists:
                        logger.info(f"Adding missing column: {column_name}", component="database_fix")
                        add_column_query = text(f"""
                            ALTER TABLE project 
                            ADD COLUMN {column_name} {column_type} NOT NULL DEFAULT {default_value};
                        """)
                        conn.execute(add_column_query)
                        conn.commit()
                        logger.info(f"Successfully added column: {column_name}", component="database_fix")
                    else:
                        logger.info(f"Column {column_name} already exists", component="database_fix")
                
                logger.info("Project counter columns check completed", component="database_fix")
                return True
                
        except Exception as e:
            logger.error(
                "Error fixing project counters",
                component="database_fix",
                error=str(e),
            )
            return False


if __name__ == "__main__":
    success = fix_project_counters()
    sys.exit(0 if success else 1)

