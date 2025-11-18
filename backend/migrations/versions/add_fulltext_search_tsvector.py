"""Add fulltext search with tsvector

Revision ID: add_fulltext_search_001
Revises: add_user_key_counters
Create Date: 2025-11-15 14:54:48.000000

This migration adds tsvector columns and GIN indexes for efficient full-text search,
replacing inefficient ILIKE queries with wildcards.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'add_fulltext_search_001'
down_revision = 'add_user_key_counters'
branch_labels = None
depends_on = None

def upgrade():

    op.execute("""
        ALTER TABLE project 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_project_search_vector 
        ON project USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION project_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', COALESCE(NEW.name, ''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS project_tsvector_update ON project;
        CREATE TRIGGER project_tsvector_update
            BEFORE INSERT OR UPDATE ON project
            FOR EACH ROW
            EXECUTE FUNCTION project_update_search_vector();
    """)

    op.execute("UPDATE project SET name = name;")

    op.execute("""
        ALTER TABLE "user" 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_search_vector 
        ON "user" USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION user_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', 
                COALESCE(NEW.username, '') || ' ' ||
                COALESCE(NEW.first_name, '') || ' ' ||
                COALESCE(NEW.last_name, '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS user_tsvector_update ON "user";
        CREATE TRIGGER user_tsvector_update
            BEFORE INSERT OR UPDATE ON "user"
            FOR EACH ROW
            EXECUTE FUNCTION user_update_search_vector();
    """)

    op.execute('UPDATE "user" SET username = username;')

    op.execute("""
        ALTER TABLE server 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_server_search_vector 
        ON server USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION server_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', 
                COALESCE(NEW.name, '') || ' ' ||
                COALESCE(NEW.ip_address, '') || ' ' ||
                COALESCE(NEW.description, '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS server_tsvector_update ON server;
        CREATE TRIGGER server_tsvector_update
            BEFORE INSERT OR UPDATE ON server
            FOR EACH ROW
            EXECUTE FUNCTION server_update_search_vector();
    """)

    op.execute("UPDATE server SET name = name;")

    op.execute("""
        ALTER TABLE user_activity 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_activity_search_vector 
        ON user_activity USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION user_activity_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', 
                COALESCE(NEW.action, '') || ' ' ||
                COALESCE(NEW.ip_address, '') || ' ' ||
                COALESCE(NEW.country, '') || ' ' ||
                COALESCE(NEW.city, '') || ' ' ||
                COALESCE(NEW.details, '') || ' ' ||
                COALESCE(NEW.user_agent, '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS user_activity_tsvector_update ON user_activity;
        CREATE TRIGGER user_activity_tsvector_update
            BEFORE INSERT OR UPDATE ON user_activity
            FOR EACH ROW
            EXECUTE FUNCTION user_activity_update_search_vector();
    """)

    op.execute("UPDATE user_activity SET action = action;")

    op.execute("""
        ALTER TABLE "key" 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_key_search_vector 
        ON "key" USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION key_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', COALESCE(NEW.key, ''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS key_tsvector_update ON "key";
        CREATE TRIGGER key_tsvector_update
            BEFORE INSERT OR UPDATE ON "key"
            FOR EACH ROW
            EXECUTE FUNCTION key_update_search_vector();
    """)

    op.execute('UPDATE "key" SET key = key;')

    op.execute("""
        ALTER TABLE changelog_entry 
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_changelog_entry_search_vector 
        ON changelog_entry USING GIN (search_vector);
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION changelog_entry_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', 
                COALESCE(NEW.version, '') || ' ' ||
                COALESCE(NEW.title, '') || ' ' ||
                COALESCE(NEW.description, '') || ' ' ||
                COALESCE(NEW.changes, '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS changelog_entry_tsvector_update ON changelog_entry;
        CREATE TRIGGER changelog_entry_tsvector_update
            BEFORE INSERT OR UPDATE ON changelog_entry
            FOR EACH ROW
            EXECUTE FUNCTION changelog_entry_update_search_vector();
    """)

    op.execute("UPDATE changelog_entry SET version = version;")

def downgrade():

    op.execute("DROP TRIGGER IF EXISTS changelog_entry_tsvector_update ON changelog_entry;")
    op.execute("DROP FUNCTION IF EXISTS changelog_entry_update_search_vector();")

    op.execute('DROP TRIGGER IF EXISTS key_tsvector_update ON "key";')
    op.execute('DROP FUNCTION IF EXISTS key_update_search_vector();')

    op.execute("DROP TRIGGER IF EXISTS user_activity_tsvector_update ON user_activity;")
    op.execute("DROP FUNCTION IF EXISTS user_activity_update_search_vector();")

    op.execute("DROP TRIGGER IF EXISTS server_tsvector_update ON server;")
    op.execute("DROP FUNCTION IF EXISTS server_update_search_vector();")

    op.execute('DROP TRIGGER IF EXISTS user_tsvector_update ON "user";')
    op.execute('DROP FUNCTION IF EXISTS user_update_search_vector();')

    op.execute("DROP TRIGGER IF EXISTS project_tsvector_update ON project;")
    op.execute("DROP FUNCTION IF EXISTS project_update_search_vector();")

    op.execute("DROP INDEX IF EXISTS idx_changelog_entry_search_vector;")
    op.execute('DROP INDEX IF EXISTS idx_key_search_vector;')
    op.execute("DROP INDEX IF EXISTS idx_user_activity_search_vector;")
    op.execute("DROP INDEX IF EXISTS idx_server_search_vector;")
    op.execute('DROP INDEX IF EXISTS idx_user_search_vector;')
    op.execute("DROP INDEX IF EXISTS idx_project_search_vector;")

    op.drop_column('changelog_entry', 'search_vector')
    op.drop_column('key', 'search_vector')
    op.drop_column('user_activity', 'search_vector')
    op.drop_column('server', 'search_vector')
    op.drop_column('user', 'search_vector')
    op.drop_column('project', 'search_vector')
