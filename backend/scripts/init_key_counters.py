"""
Script to initialize key counters for all existing users.
This should be run once after adding the denormalized key counter fields.

Usage:
    python -m backend.scripts.init_key_counters
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.app import create_app
from backend.core.extensions import db
from backend.models import User
from backend.utils.key_counters import recalculate_all_user_key_counters

def main():
    """Initialize key counters for all users"""
    app = create_app()

    with app.app_context():
        print("Initializing key counters for all users...")

        recalculate_all_user_key_counters()

        db.session.commit()

        total_users = User.query.count()
        users_with_keys = User.query.filter(User.total_keys > 0).count()

        print(f"✓ Initialization complete!")
        print(f"  Total users: {total_users}")
        print(f"  Users with keys: {users_with_keys}")
        print(f"  Users without keys: {total_users - users_with_keys}")

if __name__ == "__main__":
    main()
