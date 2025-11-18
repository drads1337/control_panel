"""
Script to initialize project statistics counters for existing projects.
This should be run after adding the denormalized counter fields to the Project model.

Usage:
    python -m backend.scripts.init_project_counters
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.core.extensions import db
from backend.models.core import Project
from backend.utils.project_counters import recalculate_all_project_counters

def main():
    """Initialize project counters for all existing projects"""
    print("Initializing project statistics counters...")

    try:

        recalculate_all_project_counters()

        db.session.commit()

        projects = Project.query.all()
        print(f"\n✓ Successfully initialized counters for {len(projects)} projects")

        for project in projects:
            print(
                f"  Project '{project.name}' (ID: {project.id}): "
                f"users={project.total_users}, keys={project.total_keys}, "
                f"games={project.total_games}, servers={project.total_servers}"
            )

        print("\n✓ All project counters initialized successfully!")

    except Exception as e:
        db.session.rollback()
        print(f"\n✗ Error initializing project counters: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
