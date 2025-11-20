"""
Script to apply the GIN indexes migration directly via SQL
This creates GIN indexes on search_vector columns for fulltext search optimization
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

def apply_gin_indexes_migration():
    """Apply the GIN indexes migration directly via SQL"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        try:
            logger.info("Applying GIN indexes migration via SQL", component="migrations")
            
            # List of tables that use search_vector for fulltext search
            tables_with_search_vector = [
                'user_activity',
                'project',
                'user',
                'server',
                'game',
                'changelog_entry',
                'key',
            ]
            
            indexes_created = 0
            indexes_skipped = 0
            tables_skipped = 0
            
            for table_name in tables_with_search_vector:
                # Check if table exists and has search_vector column
                check_column_query = text("""
                    SELECT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = :table_name 
                        AND column_name = 'search_vector'
                    )
                """)
                
                result = db.session.execute(check_column_query, {"table_name": table_name})
                has_column = result.scalar()
                
                if not has_column:
                    logger.info(f"Table {table_name} does not have search_vector column, skipping", component="migrations")
                    tables_skipped += 1
                    continue
                
                # Check if index already exists
                index_name = f"idx_{table_name}_search_vector_gin"
                check_index_query = text("""
                    SELECT EXISTS (
                        SELECT 1 
                        FROM pg_indexes 
                        WHERE tablename = :table_name 
                        AND indexname = :index_name
                    )
                """)
                
                result = db.session.execute(check_index_query, {
                    "table_name": table_name,
                    "index_name": index_name
                })
                index_exists = result.scalar()
                
                if index_exists:
                    logger.info(f"Index {index_name} already exists on {table_name}, skipping", component="migrations")
                    indexes_skipped += 1
                    continue
                
                # Create GIN index on search_vector
                logger.info(f"Creating GIN index {index_name} on {table_name}", component="migrations")
                db.session.execute(text(f"""
                    CREATE INDEX {index_name} 
                    ON {table_name} 
                    USING GIN (search_vector);
                """))
                indexes_created += 1
            
            db.session.commit()
            logger.info(
                f"GIN indexes migration completed: {indexes_created} created, {indexes_skipped} skipped, {tables_skipped} tables without column",
                component="migrations"
            )
            
            # Update alembic version table
            try:
                db.session.execute(text("""
                    INSERT INTO alembic_version (version_num)
                    VALUES ('add_gin_fulltext_indexes')
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
                "Error applying GIN indexes migration",
                component="migrations",
                error=str(e),
                traceback=traceback.format_exc(),
            )
            return False

if __name__ == "__main__":
    success = apply_gin_indexes_migration()
    sys.exit(0 if success else 1)

