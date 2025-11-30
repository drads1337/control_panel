#!/usr/bin/env python3
"""
Apply secret_key migration directly via SQL
This bypasses Alembic's revision checking for cases with missing migration files
"""
import os
import sys
import secrets
from pathlib import Path
from sqlalchemy import create_engine, text

# Add project root to path
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

os.chdir(backend_dir)

# Get DATABASE_URL
database_url = os.environ.get('DATABASE_URL')
if not database_url:
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

try:
    with engine.begin() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='project' AND column_name='secret_key'
        """))
        
        if result.fetchone():
            print("✅ Column 'secret_key' already exists in 'project' table")
            print("   Migration already applied!")
            sys.exit(0)
        
        print("Applying migration...")
        print("=" * 60)
        
        # Step 1: Add column (nullable initially)
        print("1. Adding secret_key column...")
        conn.execute(text("""
            ALTER TABLE project 
            ADD COLUMN secret_key VARCHAR(64) NULL
        """))
        print("   ✓ Column added")
        
        # Step 2: Generate unique secret_key for all existing projects
        print("2. Generating secret_key for existing projects...")
        result = conn.execute(text("SELECT id FROM project WHERE secret_key IS NULL"))
        projects = result.fetchall()
        
        updated_count = 0
        for (project_id,) in projects:
            # Generate a secure 32-byte (64 hex characters) secret key
            secret_key = secrets.token_hex(32)
            
            # Ensure uniqueness (retry if collision, though extremely unlikely)
            max_retries = 10
            for _ in range(max_retries):
                existing = conn.execute(
                    text("SELECT id FROM project WHERE secret_key = :secret_key"),
                    {"secret_key": secret_key}
                ).first()
                
                if not existing:
                    break
                secret_key = secrets.token_hex(32)
            else:
                # If we couldn't generate a unique key after retries, use project_id as suffix
                secret_key = secrets.token_hex(30) + f"{project_id:04d}"
            
            # Update the project
            conn.execute(
                text("""
                    UPDATE project 
                    SET secret_key = :secret_key 
                    WHERE id = :id
                """),
                {"secret_key": secret_key, "id": project_id}
            )
            updated_count += 1
        
        if updated_count > 0:
            print(f"   ✓ Generated secret_key for {updated_count} projects")
        
        # Step 3: Add unique constraint
        print("3. Adding unique constraint...")
        conn.execute(text("""
            ALTER TABLE project 
            ADD CONSTRAINT uq_project_secret_key UNIQUE (secret_key)
        """))
        print("   ✓ Unique constraint added")
        
        # Step 4: Make non-nullable
        print("4. Making secret_key non-nullable...")
        conn.execute(text("""
            ALTER TABLE project 
            ALTER COLUMN secret_key SET NOT NULL
        """))
        print("   ✓ Column set to NOT NULL")
        
        # Step 5: Update alembic_version to mark migration as applied
        print("5. Updating alembic_version...")
        # Check if add_project_secret_key is already in alembic_version
        result = conn.execute(
            text("SELECT version_num FROM alembic_version WHERE version_num = 'add_project_secret_key'")
        )
        if not result.fetchone():
            # Insert the revision
            conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES ('add_project_secret_key')")
            )
            print("   ✓ Migration marked as applied in alembic_version")
        else:
            print("   ✓ Migration already marked as applied")
        
        print("=" * 60)
        print("✅ Migration applied successfully!")
        print()
        print("All existing projects now have unique secret_key for token generation.")
        
except Exception as e:
    print("=" * 60)
    print(f"❌ Error applying migration: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

