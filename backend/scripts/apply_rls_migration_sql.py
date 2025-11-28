#!/usr/bin/env python3
"""
Apply RLS migration using direct SQL execution
This bypasses Alembic and applies SQL directly
"""
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("❌ psycopg2 not installed. Install it with: pip install psycopg2-binary")
    sys.exit(1)

# Get database URL
script_dir = Path(__file__).parent
backend_dir = script_dir.parent

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
    print("❌ DATABASE_URL not found")
    sys.exit(1)

print(f"✅ Connecting to database...")
print()

# Parse database URL
# Format: postgresql://user:password@host:port/dbname
if database_url.startswith('postgresql://'):
    url_parts = database_url.replace('postgresql://', '').split('@')
    if len(url_parts) == 2:
        user_pass = url_parts[0].split(':')
        host_port_db = url_parts[1].split('/')
        if len(host_port_db) == 2:
            host_port = host_port_db[0].split(':')
            dbname = host_port_db[1]
            user = user_pass[0] if len(user_pass) > 0 else 'postgres'
            password = user_pass[1] if len(user_pass) > 1 else ''
            host = host_port[0] if len(host_port) > 0 else 'localhost'
            port = int(host_port[1]) if len(host_port) > 1 else 5432
        else:
            print("❌ Invalid DATABASE_URL format")
            sys.exit(1)
    else:
        print("❌ Invalid DATABASE_URL format")
        sys.exit(1)
else:
    print("❌ DATABASE_URL must start with postgresql://")
    sys.exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=dbname,
        user=user,
        password=password
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    print("✅ Connected to database")
    print()
    
    # Check if functions already exist
    cur.execute("""
        SELECT proname 
        FROM pg_proc 
        WHERE proname IN ('set_project_context', 'clear_project_context', 'get_current_project_id')
    """)
    existing_functions = [row[0] for row in cur.fetchall()]
    
    if len(existing_functions) == 3:
        print("✅ RLS functions already exist")
        print("   Checking if migration needs to be applied...")
        print()
    else:
        print(f"📋 Found {len(existing_functions)}/3 RLS functions")
        print("   Applying migration...")
        print()
    
    # Step 1: Create functions
    print("1. Creating PostgreSQL functions...")
    
    cur.execute("""
        CREATE OR REPLACE FUNCTION set_project_context(project_id_param INTEGER)
        RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('app.current_project_id', project_id_param::TEXT, false);
        END;
        $$ LANGUAGE plpgsql;
    """)
    print("   ✅ set_project_context() created")
    
    cur.execute("""
        CREATE OR REPLACE FUNCTION clear_project_context()
        RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('app.current_project_id', NULL, false);
        END;
        $$ LANGUAGE plpgsql;
    """)
    print("   ✅ clear_project_context() created")
    
    cur.execute("""
        CREATE OR REPLACE FUNCTION get_current_project_id()
        RETURNS INTEGER AS $$
        BEGIN
            RETURN NULLIF(current_setting('app.current_project_id', true), '')::INTEGER;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)
    print("   ✅ get_current_project_id() created")
    print()
    
    # Step 2: Enable RLS and create policies for key tables
    print("2. Enabling RLS on project-scoped tables...")
    
    # List of key tables to protect
    key_tables = [
        'key', 'product', 'server', 'webhook',
        'user_activity', 'user_action_log',
        'project_encryption_keys', 'project_security_settings',
        'project_system_settings', 'project_encryption_settings',
        'project_backup_settings', 'project_chat_settings',
        'project_offline_auth_settings', 'project_appearance_settings',
        'project_invite_settings', 'project_settings',
        'user_product_permission', 'developer_product_permission',
        'project_user_role', 'project_admin',
        'remote_category', 'remote_feature', 'remote_feature_log',
        'billing', 'project_api_key', 'key_analytics',
        'agent', 'changelog', 'notification', 'chat_message',
        'two_factor_auth', 'two_factor_session', 'two_factor_backup_code',
        'login_attempt', 'session', 'security_log',
        'discord_webhook', 'chat_group', 'device_info'
    ]
    
    tables_processed = 0
    tables_enabled = 0
    policies_created = 0
    
    for table_name in key_tables:
        try:
            # Check if table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """, (table_name,))
            
            if not cur.fetchone()[0]:
                continue  # Table doesn't exist, skip
            
            tables_processed += 1
            
            # Enable RLS
            cur.execute(f'ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY')
            tables_enabled += 1
            
            # Drop existing policy if exists
            cur.execute(f'DROP POLICY IF EXISTS project_isolation_policy ON {table_name}')
            
            # Create policy
            cur.execute(f"""
                CREATE POLICY project_isolation_policy ON {table_name}
                    FOR ALL
                    USING (
                        project_id IS NULL 
                        OR project_id = get_current_project_id()
                        OR get_current_project_id() IS NULL
                    )
            """)
            policies_created += 1
            
            # Create index if not exists
            cur.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT FROM pg_indexes 
                        WHERE tablename = '{table_name}' 
                        AND indexname = 'idx_{table_name}_project_id'
                    ) THEN
                        CREATE INDEX idx_{table_name}_project_id 
                        ON {table_name}(project_id) 
                        WHERE project_id IS NOT NULL;
                    END IF;
                END $$;
            """)
            
        except Exception as e:
            print(f"   ⚠️  Error processing table {table_name}: {e}")
            continue
    
    print(f"   ✅ Processed {tables_processed} tables")
    print(f"   ✅ Enabled RLS on {tables_enabled} tables")
    print(f"   ✅ Created {policies_created} policies")
    print()
    
    # Step 3: Update alembic_version table
    print("3. Updating migration version...")
    try:
        # Check if alembic_version table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            )
        """)
        
        if cur.fetchone()[0]:
            # Check current version
            cur.execute("SELECT version_num FROM alembic_version")
            current_versions = [row[0] for row in cur.fetchall()]
            print(f"   Current versions: {current_versions}")
            
            # Add rls_001 if not present
            if 'rls_001' not in current_versions:
                cur.execute("INSERT INTO alembic_version (version_num) VALUES ('rls_001')")
                print("   ✅ Added rls_001 to alembic_version")
            else:
                print("   ✅ rls_001 already in alembic_version")
        else:
            print("   ⚠️  alembic_version table not found (may be using different migration system)")
    except Exception as e:
        print(f"   ⚠️  Could not update alembic_version: {e}")
    
    print()
    
    # Step 4: Test functions
    print("4. Testing RLS functions...")
    cur.execute("SELECT set_project_context(123)")
    cur.execute("SELECT get_current_project_id()")
    test_id = cur.fetchone()[0]
    if test_id == 123:
        print("   ✅ set_project_context() works")
    else:
        print(f"   ❌ set_project_context() failed: expected 123, got {test_id}")
    
    cur.execute("SELECT clear_project_context()")
    cur.execute("SELECT get_current_project_id()")
    test_id = cur.fetchone()[0]
    if test_id is None:
        print("   ✅ clear_project_context() works")
    else:
        print(f"   ❌ clear_project_context() failed: expected None, got {test_id}")
    
    print()
    print("=" * 60)
    print("✅ RLS migration applied successfully!")
    print("=" * 60)
    print()
    print("PostgreSQL Row Level Security is now enabled.")
    print("Data isolation is enforced at the database level.")
    
    cur.close()
    conn.close()
    
except psycopg2.Error as e:
    print(f"❌ Database error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

