"""Add GIN indexes for fulltext search

Revision ID: add_gin_fulltext_indexes
Revises: 1c4a30168a7a885b
Create Date: 2025-01-21 12:00:00.000000

This migration adds GIN (Generalized Inverted Index) indexes on search_vector columns
for all tables that use fulltext_search. GIN indexes are essential for efficient
full-text search performance on large datasets.

Without these indexes, fulltext_search queries using to_tsvector will perform
full table scans, which can "положить" (bring down) the database on large volumes.

Tables with search_vector that need indexes:
- user_activity (partitioned table - indexes will be created on each partition)
- project
- user
- server
- game
- changelog_entry
- key

Note: This migration checks if search_vector column exists before creating index,
so it's safe to run even if some tables don't have the column yet.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'add_gin_fulltext_indexes'
down_revision = 'change_price_to_float_001'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add GIN indexes on search_vector columns for all tables using fulltext_search.
    
    GIN indexes are created using the USING GIN clause, which is required for
    efficient tsvector searches. The indexes will significantly improve query
    performance for fulltext_search_filter operations.
    """
    
    # List of tables that use search_vector for fulltext search
    tables_with_search_vector = [
        'user_activity',
        'project',
        'user',
        'server',
        'game',
        'changelog_entry',
        'key',
    ]
    
    for table_name in tables_with_search_vector:
        # Check if table exists and has search_vector column
        check_column_query = text(f"""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = :table_name 
                AND column_name = 'search_vector'
            )
        """)
        
        result = op.get_bind().execute(check_column_query, {"table_name": table_name})
        has_column = result.scalar()
        
        if has_column:
            # Check if index already exists
            check_index_query = text(f"""
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_indexes 
                    WHERE tablename = :table_name 
                    AND indexname = :index_name
                )
            """)
            
            index_name = f"idx_{table_name}_search_vector_gin"
            result = op.get_bind().execute(check_index_query, {
                "table_name": table_name,
                "index_name": index_name
            })
            index_exists = result.scalar()
            
            if not index_exists:
                # Create GIN index on search_vector
                # For partitioned tables (user_activity), the index will be created on the parent
                # and automatically applied to all partitions
                op.execute(f"""
                    CREATE INDEX {index_name} 
                    ON {table_name} 
                    USING GIN (search_vector);
                """)
                print(f"Created GIN index {index_name} on {table_name}")
            else:
                print(f"Index {index_name} already exists on {table_name}, skipping")
        else:
            print(f"Table {table_name} does not have search_vector column, skipping")
    
    # For partitioned tables, we also need to ensure indexes exist on partitions
    # Check if user_activity is partitioned
    check_partitioned_query = text("""
        SELECT EXISTS (
            SELECT 1 
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'user_activity'
            AND c.relkind = 'p'
        )
    """)
    
    result = op.get_bind().execute(check_partitioned_query)
    is_partitioned = result.scalar()
    
    if is_partitioned:
        # For partitioned tables, PostgreSQL automatically creates indexes on partitions
        # when the index is created on the parent. However, we should verify this.
        # Get all partition names
        get_partitions_query = text("""
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE tablename LIKE 'user_activity_%'
            AND schemaname = 'public'
        """)
        
        partitions = op.get_bind().execute(get_partitions_query).fetchall()
        print(f"Found {len(partitions)} partitions for user_activity table")
        
        # Verify that indexes exist on partitions (they should be created automatically)
        for partition in partitions:
            partition_name = partition[1]
            check_partition_index_query = text(f"""
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_indexes 
                    WHERE tablename = :partition_name 
                    AND indexname LIKE 'idx_user_activity_search_vector_gin%'
                )
            """)
            
            result = op.get_bind().execute(check_partition_index_query, {
                "partition_name": partition_name
            })
            has_index = result.scalar()
            
            if has_index:
                print(f"Partition {partition_name} has GIN index")
            else:
                print(f"WARNING: Partition {partition_name} does not have GIN index (should be created automatically)")


def downgrade():
    """
    Remove GIN indexes on search_vector columns.
    
    This will remove the performance optimization, but queries will still work
    (just slower on large datasets).
    """
    
    tables_with_search_vector = [
        'user_activity',
        'project',
        'user',
        'server',
        'game',
        'changelog_entry',
        'key',
    ]
    
    for table_name in tables_with_search_vector:
        index_name = f"idx_{table_name}_search_vector_gin"
        
        # Check if index exists before dropping
        check_index_query = text(f"""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_indexes 
                WHERE tablename = :table_name 
                AND indexname = :index_name
            )
        """)
        
        result = op.get_bind().execute(check_index_query, {
            "table_name": table_name,
            "index_name": index_name
        })
        index_exists = result.scalar()
        
        if index_exists:
            op.execute(f"DROP INDEX IF EXISTS {index_name};")
            print(f"Dropped index {index_name} from {table_name}")
        else:
            print(f"Index {index_name} does not exist on {table_name}, skipping")

