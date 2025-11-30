#!/usr/bin/env python3
"""
Apply migration for adding project secret_key field
Uses simplified Flask app setup similar to create_owner.py
"""
import os
import sys
from pathlib import Path

# Add project root to path
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

os.chdir(backend_dir)

from flask import Flask
from flask_migrate import Migrate, upgrade
from backend.config.config import Config
from backend.core.extensions import db

def create_app():
    """Create Flask application for migrations"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app

def apply_migration():
    """Apply migrations"""
    app = create_app()
    migrate = Migrate(app, db)
    
    with app.app_context():
        print("Applying database migrations...")
        print("=" * 60)
        try:
            # Try specific revision first, then fallback to heads
            try:
                upgrade(revision="add_project_secret_key")
            except Exception:
                # If specific revision not found, try heads
                upgrade(revision="heads")
            print("=" * 60)
            print("✅ Migration applied successfully!")
            print()
            print("All existing projects now have unique secret_key for token generation.")
            return True
        except Exception as e:
            print("=" * 60)
            print(f"❌ Error applying migration: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)
