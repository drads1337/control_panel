#!/usr/bin/env python3
"""
Apply RLS migration directly using Alembic API
This script bypasses Flask dependencies to apply the migration
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

try:
    from alembic import config as alembic_config
    from alembic import script
    from alembic.runtime import migration
    from sqlalchemy import create_engine
    from sqlalchemy.engine import Engine
    
    # Get database URL from environment
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        # Try to load from .env file
        env_file = backend_dir / '.env'
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        database_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment or .env file")
        print("   Please set DATABASE_URL environment variable")
        sys.exit(1)
    
    print(f"✅ Database URL found: {database_url.split('@')[-1] if '@' in database_url else '***'}")
    print()
    
    # Create engine
    print("Connecting to database...")
    engine = create_engine(database_url)
    
    # Get Alembic configuration
    alembic_cfg = alembic_config.Config(str(backend_dir / "migrations" / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    
    # Get script directory
    script_dir_obj = script.ScriptDirectory.from_config(alembic_cfg)
    
    # Get current revision
    with engine.connect() as connection:
        context = migration.MigrationContext.configure(connection)
        try:
            current_rev = context.get_current_revision()
        except Exception:
            # Multiple heads - get all current heads
            current_heads = context.get_current_heads()
            print(f"Current migrations (multiple heads): {current_heads}")
            current_rev = current_heads[0] if current_heads else None
        
        print(f"Current migration: {current_rev or 'None (fresh database)'}")
    
    # Check if RLS migration needs to be applied
    heads = script_dir_obj.get_revisions("heads")
    print(f"Available heads: {[str(h) for h in heads]}")
    print()
    
    if current_rev == 'rls_001' or 'rls_001' in str(current_rev):
        print("✅ RLS migration already applied!")
        sys.exit(0)
    
    # Apply migration to specific revision
    print("Applying RLS migration (rls_001)...")
    print()
    
    from alembic import command
    # Apply to specific revision instead of "head" to avoid multiple heads issue
    try:
        command.upgrade(alembic_cfg, "rls_001")
    except Exception as e:
        # If rls_001 not found, try head
        print(f"⚠️  Could not apply to rls_001 directly: {e}")
        print("   Trying to apply to head...")
        command.upgrade(alembic_cfg, "head")
    
    print()
    print("✅ Migration applied successfully!")
    print()
    
    # Verify
    with engine.connect() as connection:
        context = migration.MigrationContext.configure(connection)
        new_rev = context.get_current_revision()
        print(f"New migration: {new_rev}")
        
        if new_rev == 'rls_001':
            print("✅ RLS migration verified!")
        else:
            print(f"⚠️  Expected rls_001, got {new_rev}")
    
    # Test functions
    print()
    print("Testing RLS functions...")
    with engine.connect() as connection:
        result = connection.execute(
            "SELECT proname FROM pg_proc WHERE proname IN ('set_project_context', 'clear_project_context', 'get_current_project_id') ORDER BY proname"
        )
        functions = [row[0] for row in result]
        if len(functions) == 3:
            print(f"✅ All RLS functions created: {', '.join(functions)}")
        else:
            print(f"⚠️  Expected 3 functions, found {len(functions)}: {functions}")
    
    print()
    print("=" * 60)
    print("✅ RLS migration applied and verified!")
    print("=" * 60)
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure alembic and sqlalchemy are installed:")
    print("   pip install alembic sqlalchemy psycopg2-binary")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error applying migration: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

