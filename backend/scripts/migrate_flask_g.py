"""
Script to help migrate routes from flask.g to explicit parameter passing.
This script finds patterns and suggests replacements.
"""

import re
from pathlib import Path

def migrate_file(file_path: Path):
    """Migrate a single file from flask.g to explicit parameters"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern 1: Change function signature from current_user=None to current_user
    content = re.sub(
        r'def\s+(\w+)\(([^)]*?),\s*current_user=None([^)]*)\):',
        r'def \1(\2, current_user\3):',
        content
    )
    
    # Pattern 2: Remove fallback pattern
    # if current_user is None:
    #     from flask import g
    #     current_user = g.current_user
    content = re.sub(
        r'\s+if current_user is None:\s+from flask import g\s+current_user = g\.current_user\s+',
        r' ',
        content,
        flags=re.MULTILINE
    )
    
    # Pattern 3: Remove standalone imports if not used elsewhere
    # (This is more complex and should be done manually)
    
    if content != original_content:
        print(f"Would migrate: {file_path}")
        return content
    return None

if __name__ == "__main__":
    routes_dir = Path(__file__).parent.parent / "routes"
    
    files_to_migrate = [
        routes_dir / "keys" / "analytics.py",
        routes_dir / "admin" / "users.py",
        routes_dir / "users" / "profile.py",
        routes_dir / "users" / "management.py",
        routes_dir / "users" / "clients.py",
        routes_dir / "users" / "referral_codes.py",
        routes_dir / "users" / "balance.py",
        routes_dir / "notifications.py",
        routes_dir / "rbac.py",
        routes_dir / "clients.py",
        routes_dir / "remote_control.py",
        routes_dir / "profile.py",
        routes_dir / "keys" / "validation.py",
    ]
    
    for file_path in files_to_migrate:
        if file_path.exists():
            result = migrate_file(file_path)
            if result:
                print(f"Found patterns in {file_path}")
        else:
            print(f"File not found: {file_path}")

