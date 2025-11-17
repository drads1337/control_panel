#!/usr/bin/env python3
"""
Script to remove management tab permissions from database
Removes: loaders.manage_changelog, loaders.manage_notifications, games.manage_changelog, games.manage_notifications
"""
import os
import sys
from pathlib import Path

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

# Load environment variables
from dotenv import load_dotenv
env_path = Path(project_root) / ".env"
load_dotenv(dotenv_path=str(env_path))

# Get database URL
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL environment variable is not set!")
    sys.exit(1)

try:
    from sqlalchemy import create_engine, text
except ImportError:
    print("ERROR: sqlalchemy is not installed. Install it with: pip install sqlalchemy")
    sys.exit(1)

# Permissions to remove
permissions_to_remove = [
    'loaders.manage_changelog',
    'loaders.manage_notifications',
    'games.manage_changelog',
    'games.manage_notifications',
]

def remove_permissions():
    """Remove permissions from database"""
    try:
        # Create engine
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # First, check which permissions exist
            placeholders = ','.join([f':perm{i}' for i in range(len(permissions_to_remove))])
            params = {f'perm{i}': perm for i, perm in enumerate(permissions_to_remove)}
            
            # Check existing permissions (check all projects)
            result_check = conn.execute(
                text(f"""
                    SELECT id, name, project_id 
                    FROM permission 
                    WHERE name IN ({placeholders})
                    ORDER BY project_id, name
                """),
                params
            )
            existing_permissions = result_check.fetchall()
            
            # Also check if there are any permissions with these names in any project
            print(f"\n🔍 Checking all projects for these permissions...")
            result_all = conn.execute(
                text(f"""
                    SELECT DISTINCT project_id, COUNT(*) as count
                    FROM permission 
                    WHERE name IN ({placeholders})
                    GROUP BY project_id
                """),
                params
            )
            all_projects = result_all.fetchall()
            if all_projects:
                print(f"   Found in {len(all_projects)} project(s):")
                for proj in all_projects:
                    print(f"   - project_id: {proj[0]}, count: {proj[1]}")
            
            if existing_permissions:
                print(f"\n📋 Found {len(existing_permissions)} permissions to remove:")
                for perm in existing_permissions:
                    print(f"   - {perm[1]} (id: {perm[0]}, project_id: {perm[2]})")
            else:
                print(f"\n⚠️  No permissions found with these exact names:")
                for perm_name in permissions_to_remove:
                    print(f"   - {perm_name}")
                
                # Check for similar permissions
                print("\n🔍 Checking for similar permissions in database...")
                result_similar = conn.execute(
                    text("""
                        SELECT id, name, project_id 
                        FROM permission 
                        WHERE name LIKE 'loaders.manage%' 
                           OR name LIKE 'games.manage%'
                           OR name LIKE 'loaders.notifications%'
                           OR name LIKE 'games.notifications%'
                           OR name LIKE 'loaders.changelog%'
                           OR name LIKE 'games.changelog%'
                        ORDER BY name
                    """)
                )
                similar_perms = result_similar.fetchall()
                
                if similar_perms:
                    print(f"\n📋 Found {len(similar_perms)} similar permissions:")
                    for perm in similar_perms:
                        print(f"   - {perm[1]} (id: {perm[0]}, project_id: {perm[2]})")
                else:
                    print("\n   No similar permissions found.")
                
                print("\nThese permissions may have already been removed or don't exist.")
                return
            
            # Check role_permission associations
            result_assoc = conn.execute(
                text(f"""
                    SELECT COUNT(*) 
                    FROM role_permission
                    WHERE permission_id IN (
                        SELECT id FROM permission WHERE name IN ({placeholders})
                    )
                """),
                params
            )
            assoc_count = result_assoc.scalar()
            print(f"\n📋 Found {assoc_count} role_permission associations to remove")
            
            # Start transaction
            trans = conn.begin()
            
            try:
                # Delete role_permission associations
                result1 = conn.execute(
                    text(f"""
                        DELETE FROM role_permission
                        WHERE permission_id IN (
                            SELECT id FROM permission WHERE name IN ({placeholders})
                        )
                    """),
                    params
                )
                deleted_associations = result1.rowcount
                print(f"✅ Deleted {deleted_associations} role_permission associations")
                
                # Delete the permissions themselves
                result2 = conn.execute(
                    text(f"""
                        DELETE FROM permission
                        WHERE name IN ({placeholders})
                    """),
                    params
                )
                deleted_permissions = result2.rowcount
                print(f"✅ Deleted {deleted_permissions} permissions")
                
                # Commit transaction
                trans.commit()
                
                print(f"\n✅ Successfully removed {deleted_permissions} permissions and {deleted_associations} associations")
                
            except Exception as e:
                trans.rollback()
                print(f"❌ Error during deletion: {e}")
                raise
                
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("Removing management tab permissions from database...")
    print(f"Permissions to remove: {', '.join(permissions_to_remove)}\n")
    
    confirm = input("Are you sure you want to delete these permissions? (yes/no): ")
    if confirm.lower() not in ['yes', 'y']:
        print("Cancelled.")
        sys.exit(0)
    
    remove_permissions()

