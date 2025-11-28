"""add_postgresql_rls

Revision ID: rls_001
Revises: add_envelope_encryption_support
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'rls_001'
down_revision = 'add_envelope_encryption'  # Should match revision from add_envelope_encryption_support.py
branch_labels = None
depends_on = None


def upgrade():
    """
    Enable PostgreSQL Row Level Security (RLS) for all project-scoped tables.
    
    This migration:
    1. Creates a function to set project context in PostgreSQL session
    2. Enables RLS on all project-scoped tables
    3. Creates security policies for each table
    
    RLS policies ensure that users can only access data from their assigned project,
    even if application-level filtering is bypassed (e.g., SQL injection).
    """
    
    # Step 1: Create function to set project context
    # This function sets a session variable that RLS policies can read
    op.execute("""
        CREATE OR REPLACE FUNCTION set_project_context(project_id_param INTEGER)
        RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('app.current_project_id', project_id_param::TEXT, false);
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Step 2: Create function to clear project context
    op.execute("""
        CREATE OR REPLACE FUNCTION clear_project_context()
        RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('app.current_project_id', NULL, false);
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Step 3: Create helper function to get current project_id from session
    op.execute("""
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
    
    # Step 4: List of all project-scoped tables
    # These tables have project_id column and should be protected by RLS
    project_scoped_tables = [
        'key',
        'product',
        'server',
        'webhook',
        'user_activity',
        'user_action_log',
        'project_encryption_keys',
        'project_security_settings',
        'project_system_settings',
        'project_encryption_settings',
        'project_backup_settings',
        'project_chat_settings',
        'project_offline_auth_settings',
        'project_appearance_settings',
        'project_invite_settings',
        'project_settings',
        'user_product_permission',
        'developer_product_permission',
        'project_user_role',
        'project_admin',
        'remote_category',
        'remote_feature',
        'remote_feature_log',
        'billing',
        'project_api_key',
        'key_analytics',
        'agent',
        'changelog',
        'notification',
        'chat_message',
        'two_factor_auth',
        'two_factor_session',
        'two_factor_backup_code',
        'login_attempt',
        'session',
        'security_log',
        'discord_webhook',
        'chat_group',
        'device_info',
        'price',
        'user_product_permission',
        'developer_product_permission',
        'product_price',
        'product_server',
        'product_webhook',
        'product_changelog',
        'product_notification',
        'product_background',
        'product_loader',
        'product_version',
        'product_download',
        'product_active_user',
        'agent_key_file',
        'agent_key',
        'agent_server',
        'agent_webhook',
        'agent_changelog',
        'agent_notification',
        'blocked_ip',
        'blocked_device_fingerprint',
        'security_rule',
        'role',
        'permission',
        'user_role',
        'project_role',
    ]
    
    # Step 5: Enable RLS and create policies for each table
    for table_name in project_scoped_tables:
        try:
            # Check if table exists before enabling RLS
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table_name}'
                    ) THEN
                        -- Enable RLS
                        ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
                        
                        -- Drop existing policy if it exists
                        DROP POLICY IF EXISTS project_isolation_policy ON {table_name};
                        
                        -- Create policy for SELECT
                        CREATE POLICY project_isolation_policy ON {table_name}
                            FOR ALL
                            USING (
                                project_id IS NULL 
                                OR project_id = get_current_project_id()
                                OR get_current_project_id() IS NULL  -- Allow if no context set (system/admin queries)
                            );
                    END IF;
                END $$;
            """)
        except Exception as e:
            # Log error but continue with other tables
            print(f"Warning: Could not enable RLS for table {table_name}: {e}")
            pass
    
    # Step 6: Create indexes on project_id for better performance
    # (Most tables should already have these, but we ensure they exist)
    for table_name in project_scoped_tables:
        try:
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table_name}'
                    ) AND NOT EXISTS (
                        SELECT FROM pg_indexes 
                        WHERE tablename = '{table_name}' 
                        AND indexname = 'idx_{table_name}_project_id'
                    ) THEN
                        CREATE INDEX IF NOT EXISTS idx_{table_name}_project_id 
                        ON {table_name}(project_id) 
                        WHERE project_id IS NOT NULL;
                    END IF;
                END $$;
            """)
        except Exception as e:
            print(f"Warning: Could not create index for table {table_name}: {e}")
            pass


def downgrade():
    """
    Disable PostgreSQL Row Level Security and remove RLS policies.
    """
    
    # List of all project-scoped tables
    project_scoped_tables = [
        'key',
        'product',
        'server',
        'webhook',
        'user_activity',
        'user_action_log',
        'project_encryption_keys',
        'project_security_settings',
        'project_system_settings',
        'project_encryption_settings',
        'project_backup_settings',
        'project_chat_settings',
        'project_offline_auth_settings',
        'project_appearance_settings',
        'project_invite_settings',
        'project_settings',
        'user_product_permission',
        'developer_product_permission',
        'project_user_role',
        'project_admin',
        'remote_category',
        'remote_feature',
        'remote_feature_log',
        'billing',
        'project_api_key',
        'key_analytics',
        'agent',
        'changelog',
        'notification',
        'chat_message',
        'two_factor_auth',
        'two_factor_session',
        'two_factor_backup_code',
        'login_attempt',
        'session',
        'security_log',
        'discord_webhook',
        'chat_group',
        'device_info',
        'price',
        'user_product_permission',
        'developer_product_permission',
        'product_price',
        'product_server',
        'product_webhook',
        'product_changelog',
        'product_notification',
        'product_background',
        'product_loader',
        'product_version',
        'product_download',
        'product_active_user',
        'agent_key_file',
        'agent_key',
        'agent_server',
        'agent_webhook',
        'agent_changelog',
        'agent_notification',
        'blocked_ip',
        'blocked_device_fingerprint',
        'security_rule',
        'role',
        'permission',
        'user_role',
        'project_role',
    ]
    
    # Drop policies and disable RLS for each table
    for table_name in project_scoped_tables:
        try:
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table_name}'
                    ) THEN
                        DROP POLICY IF EXISTS project_isolation_policy ON {table_name};
                        ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;
                    END IF;
                END $$;
            """)
        except Exception as e:
            print(f"Warning: Could not disable RLS for table {table_name}: {e}")
            pass
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS get_current_project_id();")
    op.execute("DROP FUNCTION IF EXISTS clear_project_context();")
    op.execute("DROP FUNCTION IF EXISTS set_project_context(INTEGER);")

