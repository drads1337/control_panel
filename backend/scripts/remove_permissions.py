
"""
Script to remove specific permissions from the database
"""
import sys
import os
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

project_root = backend_dir.parent
env_path = project_root / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy import create_engine, text
from config.config import Config

permissions_to_remove = [
    'loaders.manage_changelog',
    'loaders.manage_notifications',
    'games.manage_changelog',
    'games.manage_notifications',
    'logs.view_all',
]

def remove_permissions():
    """Remove permissions from the database"""
    try:

        engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)

        with engine.begin() as conn:
            print("=" * 80)
            print("Removing permissions from database...")
            print("=" * 80)
            print()

            print("Checking permissions to remove:")
            for perm_name in permissions_to_remove:
                check_query = text("""
                    SELECT 
                        p.id,
                        p.name,
                        COUNT(rp.id) as role_count
                    FROM permission p
                    LEFT JOIN role_permission rp ON p.id = rp.permission_id
                    WHERE p.name = :perm_name
                    GROUP BY p.id, p.name
                """)

                result = conn.execute(check_query, {"perm_name": perm_name})
                row = result.fetchone()

                if row:
                    print(f"  - {perm_name} (ID: {row.id}, assigned to {row.role_count} role(s))")
                else:
                    print(f"  - {perm_name} (NOT FOUND)")

            print()

            print("Proceeding with deletion...")
            print()
            print("Removing role_permission associations...")

            placeholders = ','.join([f':perm{i}' for i in range(len(permissions_to_remove))])
            exact_params = {f'perm{i}': perm for i, perm in enumerate(permissions_to_remove)}

            delete_role_perms_query = text(f"""
                DELETE FROM role_permission
                WHERE permission_id IN (
                    SELECT id FROM permission WHERE name IN ({placeholders})
                )
            """)

            result = conn.execute(delete_role_perms_query, exact_params)
            role_perms_deleted = result.rowcount
            print(f"  - Deleted {role_perms_deleted} role_permission associations")

            print("Removing permissions...")
            delete_perms_query = text(f"""
                DELETE FROM permission
                WHERE name IN ({placeholders})
            """)

            result = conn.execute(delete_perms_query, exact_params)
            perms_deleted = result.rowcount
            print(f"  - Deleted {perms_deleted} permissions")

            print()
            print("=" * 80)
            print("✅ Permissions removed successfully!")
            print("=" * 80)
            print(f"Summary:")
            print(f"  - Role-permission associations deleted: {role_perms_deleted}")
            print(f"  - Permissions deleted: {perms_deleted}")
            print()

    except Exception as e:
        print(f"❌ Error removing permissions: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(remove_permissions())
