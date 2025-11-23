#!/usr/bin/env python3
"""
Migration script to migrate all projects from ProjectSettings to specialized models.

This script should be run ONCE after deploying the code changes.
It migrates data from the legacy ProjectSettings model to specialized models.

Usage:
    python backend/scripts/migrate_all_project_settings.py
"""

import os
import sys

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

os.chdir(backend_dir)

from flask import Flask
from backend.config.config import Config
from backend.core.extensions import db
from backend.models.core import Project
from backend.utils.project_settings_migration import migrate_project_settings
from backend.utils.structured_logging import get_logger

logger = get_logger("migrate_all_project_settings")


def main():
    """Migrate all projects from ProjectSettings to specialized models"""
    
    # Create Flask app
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        try:
            # Get all projects
            projects = Project.query.all()
            
            if not projects:
                logger.warning("No projects found in database")
                print("⚠️  No projects found in database")
                return
            
            logger.info(f"Found {len(projects)} projects to migrate")
            print(f"\n📋 Found {len(projects)} projects to migrate\n")
            print("=" * 80)
            
            success_count = 0
            failed_count = 0
            skipped_count = 0
            
            for project in projects:
                project_id = project.id
                project_name = project.name or f"Project {project_id}"
                
                print(f"\n🔄 Migrating project {project_id}: {project_name}")
                
                try:
                    # Check if ProjectSettings exists for this project
                    from backend.models.core import ProjectSettings
                    legacy_settings = ProjectSettings.query.filter_by(project_id=project_id).first()
                    
                    if not legacy_settings:
                        logger.info(f"Project {project_id} has no legacy ProjectSettings, skipping migration")
                        print(f"   ⏭️  No legacy settings found, skipping (will use defaults)")
                        skipped_count += 1
                        continue
                    
                    # Run migration
                    results = migrate_project_settings(project_id)
                    
                    # Check results
                    all_success = all(results.values())
                    some_success = any(results.values())
                    
                    if all_success:
                        success_count += 1
                        print(f"   ✅ Migration successful for all settings")
                        logger.info(f"Successfully migrated all settings for project {project_id}")
                    elif some_success:
                        success_count += 1
                        failed_parts = [k for k, v in results.items() if not v]
                        print(f"   ⚠️  Migration partially successful (failed: {', '.join(failed_parts)})")
                        logger.warning(f"Partially migrated project {project_id}, failed parts: {failed_parts}")
                    else:
                        failed_count += 1
                        print(f"   ❌ Migration failed for all settings")
                        logger.error(f"Failed to migrate project {project_id}")
                    
                    # Print detailed results
                    for setting_type, success in results.items():
                        status = "✅" if success else "❌"
                        print(f"      {status} {setting_type}")
                    
                except Exception as e:
                    failed_count += 1
                    error_msg = str(e)
                    print(f"   ❌ Error: {error_msg}")
                    logger.error(f"Error migrating project {project_id}: {e}", exc_info=True)
            
            # Print summary
            print("\n" + "=" * 80)
            print("\n📊 Migration Summary:")
            print(f"   ✅ Successful: {success_count}")
            print(f"   ❌ Failed: {failed_count}")
            print(f"   ⏭️  Skipped (no legacy settings): {skipped_count}")
            print(f"   📦 Total: {len(projects)}")
            
            logger.info(
                f"Migration completed: {success_count} successful, {failed_count} failed, {skipped_count} skipped"
            )
            
            if failed_count > 0:
                print("\n⚠️  Some projects failed to migrate. Check logs for details.")
                return 1
            else:
                print("\n✅ All migrations completed successfully!")
                return 0
                
        except Exception as e:
            logger.error(f"Fatal error during migration: {e}", exc_info=True)
            print(f"\n❌ Fatal error: {e}")
            return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

