#!/usr/bin/env python3
"""
Script to check if specific permissions exist in the database
"""
import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

# Load environment variables
project_root = backend_dir.parent
env_path = project_root / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy import create_engine, text
from config.config import Config

# Permissions to check
permissions_to_check = [
    'loaders.manage_changelog',
    'loaders.manage_notifications',
    'games.manage_changelog',
    'games.manage_notifications',
]

def check_permissions():
    """Check if permissions exist in the database"""
    try:
        # Create database connection
        engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
        
        with engine.connect() as conn:
            print("=" * 80)
            print("Checking permissions in database...")
            print("=" * 80)
            print()
            
            # Check each permission
            for perm_name in permissions_to_check:
                query = text("""
                    SELECT 
                        p.id,
                        p.name,
                        p.description,
                        p.resource,
                        p.action,
                        p.project_id,
                        COUNT(rp.id) as role_count
                    FROM permission p
                    LEFT JOIN role_permission rp ON p.id = rp.permission_id
                    WHERE p.name = :perm_name
                    GROUP BY p.id, p.name, p.description, p.resource, p.action, p.project_id
                """)
                
                result = conn.execute(query, {"perm_name": perm_name})
                rows = result.fetchall()
                
                if rows:
                    print(f"✅ {perm_name}: FOUND")
                    for row in rows:
                        print(f"   - ID: {row.id}")
                        print(f"   - Description: {row.description}")
                        print(f"   - Resource: {row.resource}")
                        print(f"   - Action: {row.action}")
                        print(f"   - Project ID: {row.project_id}")
                        print(f"   - Assigned to {row.role_count} role(s)")
                        print()
                else:
                    print(f"❌ {perm_name}: NOT FOUND")
                    print()
            
            # Summary: Check all projects
            print("=" * 80)
            print("Summary by project:")
            print("=" * 80)
            
            summary_query = text("""
                SELECT 
                    p.project_id,
                    COUNT(DISTINCT CASE WHEN p.name IN :perms THEN p.id END) as found_count,
                    COUNT(DISTINCT p.id) as total_perms
                FROM permission p
                WHERE p.name IN :perms
                GROUP BY p.project_id
                ORDER BY p.project_id
            """)
            
            result = conn.execute(summary_query, {"perms": tuple(permissions_to_check)})
            summary_rows = result.fetchall()
            
            if summary_rows:
                for row in summary_rows:
                    print(f"Project ID {row.project_id}: {row.found_count} of {len(permissions_to_check)} permissions found")
            else:
                print("No permissions found in any project")
            
            print()
            print("=" * 80)
            
    except Exception as e:
        print(f"Error checking permissions: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(check_permissions())

