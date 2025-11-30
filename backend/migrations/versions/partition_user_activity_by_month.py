"""Partition user_activity table by month

Revision ID: partition_user_activity
Revises: add_project_secret_key
Create Date: 2025-01-XX XX:XX:XX

This migration partitions the user_activity table by month for better performance
and easier data management. Old data can be archived by dropping old partitions.

PERFORMANCE: Partitioning improves query performance on large tables by:
- Reducing index size per partition
- Enabling partition pruning in queries
- Allowing parallel scans across partitions
- Simplifying data archival (drop old partitions)

The table is partitioned by created_at using RANGE partitioning by month.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime, timedelta


# revision identifiers, used by Alembic.
revision = 'partition_user_activity'
down_revision = 'add_project_secret_key'  # Update based on your latest migration
branch_labels = None
depends_on = None


def get_partition_name(year: int, month: int) -> str:
    """Generate partition name for given year and month."""
    return f"user_activity_{year}_{month:02d}"


def create_partition_for_month(year: int, month: int, connection):
    """Create a partition for a specific month."""
    partition_name = get_partition_name(year, month)
    
    # Calculate start and end dates for the partition
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    # Create partition
    connection.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF user_activity
        FOR VALUES FROM ('{start_str}') TO ('{end_str}')
    """))
    
    print(f"✅ Created partition {partition_name} for {start_str} to {end_str}")


def is_table_partitioned(connection) -> bool:
    """Check if user_activity table is already partitioned."""
    result = connection.execute(text("""
        SELECT EXISTS (
            SELECT FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
            AND c.relname = 'user_activity'
            AND c.relkind = 'p'  -- 'p' = partitioned table
        )
    """))
    return result.scalar()


def index_exists(connection, index_name: str) -> bool:
    """Check if index exists."""
    result = connection.execute(text("""
        SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = :index_name
        )
    """), {"index_name": index_name})
    return result.scalar()


def create_index_concurrently(connection, index_name: str, index_sql: str):
    """
    Create index with CONCURRENTLY if it doesn't exist.
    
    NOTE: CONCURRENTLY cannot be used inside a transaction.
    This function commits the current transaction, creates the index, then starts a new transaction.
    """
    if index_exists(connection, index_name):
        print(f"⏭️  Index {index_name} already exists, skipping")
        return
    
    try:
        # Commit current transaction (CONCURRENTLY requires no active transaction)
        connection.commit()
        
        # Create index with CONCURRENTLY
        print(f"📋 Creating index {index_name} with CONCURRENTLY...")
        connection.execute(text(index_sql))
        connection.commit()
        
        print(f"✅ Created index {index_name}")
    except Exception as e:
        print(f"⚠️  Failed to create index {index_name} with CONCURRENTLY: {e}")
        print(f"   Falling back to regular index creation...")
        # Fallback to regular index creation
        index_sql_regular = index_sql.replace("CONCURRENTLY", "").strip()
        connection.execute(text(index_sql_regular))
        connection.commit()
    finally:
        # Start new transaction for subsequent operations
        connection.execute(text("BEGIN"))


def upgrade():
    """
    Partition user_activity table by month.
    
    Steps:
    1. Check if already partitioned (idempotency)
    2. Create new partitioned table structure
    3. Migrate existing data (with batching for large datasets)
    4. Safely replace old table with new one
    5. Create partitions for current and next 3 months
    
    PERFORMANCE NOTES:
    - Indexes are created with CONCURRENTLY to avoid blocking the table
    - Data migration uses batching for large datasets
    - Table replacement uses rename instead of DROP CASCADE for safety
    """
    connection = op.get_bind()
    
    # Check if table exists
    result = connection.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_activity'
        )
    """))
    
    table_exists = result.scalar()
    
    if not table_exists:
        print("⚠️  user_activity table does not exist. Skipping partitioning.")
        return
    
    # IDEMPOTENCY: Check if table is already partitioned
    if is_table_partitioned(connection):
        print("⚠️  user_activity table is already partitioned. Skipping.")
        return
    
    print("🔄 Starting user_activity table partitioning...")
    
    # Step 1: Create new partitioned table
    print("📋 Creating partitioned table structure...")
    
    # Create new partitioned table
    connection.execute(text("""
        CREATE TABLE user_activity_partitioned (
            id INTEGER NOT NULL,
            user_id INTEGER,
            action VARCHAR(128) NOT NULL,
            ip_address VARCHAR(64),
            user_agent VARCHAR(512),
            country VARCHAR(64),
            city VARCHAR(64),
            created_at TIMESTAMP,
            project_id INTEGER,
            details TEXT,
            session_id VARCHAR(128),
            PRIMARY KEY (id, created_at),
            FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES project (id)
        ) PARTITION BY RANGE (created_at)
    """))
    
    # Create indexes on partitioned table with CONCURRENTLY
    # Note: We'll create indexes after data migration to avoid blocking
    # For now, we just create the table structure
    print("✅ Created partitioned table structure")
    print("📋 Indexes will be created after data migration (with CONCURRENTLY)")
    
    # Step 2: Get date range of existing data
    result = connection.execute(text("""
        SELECT 
            MIN(created_at) as min_date,
            MAX(created_at) as max_date,
            COUNT(*) as row_count
        FROM user_activity
    """))
    
    row = result.fetchone()
    min_date = row[0] if row[0] else datetime.now()
    max_date = row[1] if row[1] else datetime.now()
    row_count = row[2] if row[2] else 0
    
    print(f"📊 Existing data: {row_count} rows from {min_date} to {max_date}")
    
    if row_count > 0:
        # Step 3: Create partitions for all months with data
        current_date = datetime(min_date.year, min_date.month, 1)
        end_date = max_date + timedelta(days=32)  # Add buffer
        end_date = datetime(end_date.year, end_date.month, 1)
        
        partitions_created = []
        while current_date < end_date:
            create_partition_for_month(current_date.year, current_date.month, connection)
            partitions_created.append((current_date.year, current_date.month))
            
            # Move to next month
            if current_date.month == 12:
                current_date = datetime(current_date.year + 1, 1, 1)
            else:
                current_date = datetime(current_date.year, current_date.month + 1, 1)
        
        # Step 4: Migrate data with batching for large datasets
        print("📦 Migrating existing data...")
        
        # Use batching for large datasets (>100k rows)
        if row_count > 100000:
            print(f"   Large dataset detected ({row_count} rows), using batching...")
            BATCH_SIZE = 10000
            offset = 0
            total_migrated = 0
            
            while True:
                result = connection.execute(text("""
                    INSERT INTO user_activity_partitioned
                    SELECT * FROM user_activity
                    WHERE id > :offset
                    ORDER BY id
                    LIMIT :batch_size
                """), {"offset": offset, "batch_size": BATCH_SIZE})
                
                rows_inserted = result.rowcount
                if rows_inserted == 0:
                    break
                
                total_migrated += rows_inserted
                offset = total_migrated
                connection.commit()
                
                if total_migrated % 50000 == 0:
                    print(f"   Migrated {total_migrated}/{row_count} rows...")
            
            print(f"✅ Migrated {total_migrated} rows")
        else:
            # For smaller datasets, migrate all at once
            connection.execute(text("""
                INSERT INTO user_activity_partitioned
                SELECT * FROM user_activity
            """))
            connection.commit()
            print(f"✅ Migrated {row_count} rows")
    
    # Step 5: Create partitions for next 3 months (for future data)
    now = datetime.now()
    for i in range(3):
        future_date = now + timedelta(days=30 * i)
        year = future_date.year
        month = future_date.month
        
        partition_name = get_partition_name(year, month)
        result = connection.execute(text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = '{partition_name}'
            )
        """))
        
        if not result.scalar():
            create_partition_for_month(year, month, connection)
    
    # Step 6: Create indexes with CONCURRENTLY (after data migration)
    print("📋 Creating indexes with CONCURRENTLY...")
    
    indexes = [
        ("idx_user_activity_partitioned_project_created", 
         "CREATE INDEX CONCURRENTLY idx_user_activity_partitioned_project_created ON user_activity_partitioned (project_id, created_at)"),
        ("idx_user_activity_partitioned_user_created",
         "CREATE INDEX CONCURRENTLY idx_user_activity_partitioned_user_created ON user_activity_partitioned (user_id, created_at)"),
        ("ix_user_activity_partitioned_created_at",
         "CREATE INDEX CONCURRENTLY ix_user_activity_partitioned_created_at ON user_activity_partitioned (created_at)"),
        ("ix_user_activity_partitioned_project_id",
         "CREATE INDEX CONCURRENTLY ix_user_activity_partitioned_project_id ON user_activity_partitioned (project_id)"),
    ]
    
    for index_name, index_sql in indexes:
        create_index_concurrently(connection, index_name, index_sql)
    
    # Step 7: Safely replace old table with new one
    print("🔄 Replacing old table with partitioned table...")
    
    # SAFETY: Use rename instead of DROP CASCADE to preserve dependencies
    # 1. Rename old table (as backup)
    connection.execute(text("""
        ALTER TABLE IF EXISTS user_activity RENAME TO user_activity_old_backup
    """))
    connection.commit()
    
    # 2. Rename new table
    connection.execute(text("""
        ALTER TABLE user_activity_partitioned RENAME TO user_activity
    """))
    connection.commit()
    
    # 3. Drop old table (can be done later after verification)
    # For safety, we'll leave the backup table for manual cleanup
    print("⚠️  Old table renamed to user_activity_old_backup")
    print("   You can drop it manually after verifying the migration:")
    print("   DROP TABLE IF EXISTS user_activity_old_backup CASCADE;")
    
    print("✅ Partitioning completed successfully!")
    print("\n📝 Notes:")
    print("  - Table is now partitioned by month")
    print("  - Old partitions can be dropped to archive data:")
    print("    DROP TABLE user_activity_YYYY_MM;")
    print("  - Create new partitions manually for future months or use a scheduled job")


def downgrade():
    """
    Revert partitioning - merge partitions back into single table.
    
    WARNING: This will merge all partitions into a single table.
    For large datasets, this may take significant time.
    """
    connection = op.get_bind()
    
    print("🔄 Reverting partitioning...")
    
    # Get all partition names
    result = connection.execute(text("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'user_activity_%'
        ORDER BY tablename
    """))
    
    partitions = [row[0] for row in result]
    
    if not partitions:
        print("⚠️  No partitions found. Table may not be partitioned.")
        return
    
    print(f"📋 Found {len(partitions)} partitions to merge")
    
    # Create new non-partitioned table
    connection.execute(text("""
        CREATE TABLE user_activity_merged (
            id INTEGER NOT NULL,
            user_id INTEGER,
            action VARCHAR(128) NOT NULL,
            ip_address VARCHAR(64),
            user_agent VARCHAR(512),
            country VARCHAR(64),
            city VARCHAR(64),
            created_at TIMESTAMP,
            project_id INTEGER,
            details TEXT,
            session_id VARCHAR(128),
            PRIMARY KEY (id),
            FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES project (id)
        )
    """))
    
    # Create indexes
    connection.execute(text("""
        CREATE INDEX idx_user_activity_merged_project_created 
        ON user_activity_merged (project_id, created_at)
    """))
    
    connection.execute(text("""
        CREATE INDEX idx_user_activity_merged_user_created 
        ON user_activity_merged (user_id, created_at)
    """))
    
    connection.execute(text("""
        CREATE INDEX ix_user_activity_merged_created_at 
        ON user_activity_merged (created_at)
    """))
    
    connection.execute(text("""
        CREATE INDEX ix_user_activity_merged_project_id 
        ON user_activity_merged (project_id)
    """))
    
    # Copy data from all partitions
    print("📦 Merging data from partitions...")
    for partition in partitions:
        connection.execute(text(f"""
            INSERT INTO user_activity_merged
            SELECT id, user_id, action, ip_address, user_agent, 
                   country, city, created_at, project_id, details, session_id
            FROM {partition}
        """))
        print(f"  ✅ Merged {partition}")
    
    # Drop partitioned table and partitions
    connection.execute(text("DROP TABLE IF EXISTS user_activity CASCADE"))
    
    # Rename merged table
    connection.execute(text("ALTER TABLE user_activity_merged RENAME TO user_activity"))
    
    print("✅ Reverted to non-partitioned table")

