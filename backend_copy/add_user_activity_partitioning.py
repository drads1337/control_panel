"""Add partitioning to user_activity table

Revision ID: a1b2c3d4e5f6
Revises: f717e2105666
Create Date: 2025-01-20 12:00:00.000000

This migration adds range partitioning to the user_activity table by date (created_at).
Partitioning significantly improves query performance and maintenance for large tables
that grow exponentially over time.

Partitioning strategy:
- Monthly partitions (RANGE partitioning by created_at)
- Automatic partition creation function
- Existing data moved to appropriate partitions
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timedelta
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '1c4a30168a7a885b'
down_revision = 'f717e2105666'
branch_labels = None
depends_on = None


def upgrade():
    """
    Convert user_activity table to partitioned table by created_at date.
    
    Steps:
    1. Create new partitioned table structure
    2. Create partitions for existing data and future months
    3. Migrate existing data
    4. Replace old table with partitioned table
    5. Create function for automatic partition creation
    """
    
    # Step 1: Create new partitioned table (temporary name)
    op.execute("""
        CREATE TABLE user_activity_partitioned (
            LIKE user_activity INCLUDING ALL
        ) PARTITION BY RANGE (created_at);
    """)
    
    # Step 2: Create partitions for the last 12 months and next 12 months
    # This covers existing data and future growth
    current_date = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Create partitions for past 12 months
    for i in range(12, 0, -1):
        partition_start = current_date - timedelta(days=30 * i)
        partition_end = partition_start + timedelta(days=32)  # Slightly overlap to ensure coverage
        partition_name = f"user_activity_{partition_start.strftime('%Y_%m')}"
        
        op.execute(f"""
            CREATE TABLE {partition_name} PARTITION OF user_activity_partitioned
            FOR VALUES FROM ('{partition_start.isoformat()}') TO ('{partition_end.isoformat()}');
        """)
    
    # Create partition for current month
    current_month_start = current_date
    current_month_end = current_date + timedelta(days=32)
    current_partition = f"user_activity_{current_month_start.strftime('%Y_%m')}"
    
    op.execute(f"""
        CREATE TABLE {current_partition} PARTITION OF user_activity_partitioned
        FOR VALUES FROM ('{current_month_start.isoformat()}') TO ('{current_month_end.isoformat()}');
    """)
    
    # Create partitions for next 12 months
    for i in range(1, 13):
        partition_start = current_date + timedelta(days=30 * i)
        partition_end = partition_start + timedelta(days=32)
        partition_name = f"user_activity_{partition_start.strftime('%Y_%m')}"
        
        op.execute(f"""
            CREATE TABLE {partition_name} PARTITION OF user_activity_partitioned
            FOR VALUES FROM ('{partition_start.isoformat()}') TO ('{partition_end.isoformat()}');
        """)
    
    # Step 3: Migrate existing data
    op.execute("""
        INSERT INTO user_activity_partitioned
        SELECT * FROM user_activity;
    """)
    
    # Step 4: Drop old table and rename new one
    op.execute("DROP TABLE user_activity CASCADE;")
    op.execute("ALTER TABLE user_activity_partitioned RENAME TO user_activity;")
    
    # Step 5: Recreate indexes on partitioned table
    op.execute("""
        CREATE INDEX idx_user_activity_project_created 
        ON user_activity (project_id, created_at);
    """)
    
    op.execute("""
        CREATE INDEX idx_user_activity_user_created 
        ON user_activity (user_id, created_at);
    """)
    
    op.execute("""
        CREATE INDEX idx_user_activity_created_at 
        ON user_activity (created_at);
    """)
    
    # Step 6: Create function for automatic partition creation
    # This function should be called monthly (via cron or scheduled task)
    op.execute("""
        CREATE OR REPLACE FUNCTION create_user_activity_partition(partition_date DATE)
        RETURNS VOID AS $$
        DECLARE
            partition_name TEXT;
            partition_start DATE;
            partition_end DATE;
        BEGIN
            -- Calculate partition boundaries (first day of month)
            partition_start := DATE_TRUNC('month', partition_date);
            partition_end := partition_start + INTERVAL '1 month';
            
            -- Generate partition name
            partition_name := 'user_activity_' || TO_CHAR(partition_start, 'YYYY_MM');
            
            -- Check if partition already exists
            IF NOT EXISTS (
                SELECT 1 FROM pg_class WHERE relname = partition_name
            ) THEN
                -- Create partition
                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF user_activity FOR VALUES FROM (%L) TO (%L)',
                    partition_name,
                    partition_start,
                    partition_end
                );
                
                RAISE NOTICE 'Created partition: %', partition_name;
            ELSE
                RAISE NOTICE 'Partition % already exists', partition_name;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Step 7: Create function to auto-create next month's partition
    # This should be called monthly before the month starts
    op.execute("""
        CREATE OR REPLACE FUNCTION ensure_user_activity_partitions()
        RETURNS VOID AS $$
        DECLARE
            next_month DATE;
            months_ahead INTEGER := 3;  -- Create partitions 3 months ahead
            i INTEGER;
        BEGIN
            FOR i IN 0..months_ahead LOOP
                next_month := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
                PERFORM create_user_activity_partition(next_month);
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create initial partitions for next 3 months
    op.execute("SELECT ensure_user_activity_partitions();")


def downgrade():
    """
    Remove partitioning from user_activity table.
    
    This will merge all partitions back into a single table.
    Note: This operation can be slow for large datasets.
    """
    
    # Step 1: Create non-partitioned table
    op.execute("""
        CREATE TABLE user_activity_merged (
            LIKE user_activity INCLUDING ALL
        );
    """)
    
    # Step 2: Copy all data from partitions
    op.execute("""
        INSERT INTO user_activity_merged
        SELECT * FROM user_activity;
    """)
    
    # Step 3: Drop partitioned table and functions
    op.execute("DROP TABLE user_activity CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS create_user_activity_partition(DATE);")
    op.execute("DROP FUNCTION IF EXISTS ensure_user_activity_partitions();")
    
    # Step 4: Rename merged table
    op.execute("ALTER TABLE user_activity_merged RENAME TO user_activity;")
    
    # Step 5: Recreate indexes
    op.execute("""
        CREATE INDEX idx_user_activity_project_created 
        ON user_activity (project_id, created_at);
    """)
    
    op.execute("""
        CREATE INDEX idx_user_activity_user_created 
        ON user_activity (user_id, created_at);
    """)
    
    op.execute("""
        CREATE INDEX idx_user_activity_created_at 
        ON user_activity (created_at);
    """)

